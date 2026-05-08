-- ══════════════════════════════════════════
-- shop_events: consumer engagement tracking
-- ══════════════════════════════════════════

-- Event types:
--   shop_view       : user opens shop detail page
--   photo_view      : user views a gallery photo (fullscreen)
--   photo_bookmark  : user bookmarks a photo (future feature placeholder)
--   order_click     : user clicks the "주문하기" CTA button
--   share_click     : user clicks share button

CREATE TABLE IF NOT EXISTS shop_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_shop_events_shop_id ON shop_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_events_type ON shop_events(event_type);
CREATE INDEX IF NOT EXISTS idx_shop_events_created ON shop_events(created_at);

-- ══════════════════════════════════════════
-- shop_popularity: pre-computed popularity scores (updated periodically or on-demand)
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shop_popularity (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  view_count integer DEFAULT 0,
  photo_view_count integer DEFAULT 0,
  bookmark_count integer DEFAULT 0,
  review_count integer DEFAULT 0,
  avg_rating numeric(3,2) DEFAULT 0,
  order_click_count integer DEFAULT 0,
  score numeric(10,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- RLS: allow public read, insert events for anyone (including anonymous)
ALTER TABLE shop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_popularity ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (including anonymous visitors)
CREATE POLICY "Anyone can insert shop events" ON shop_events
  FOR INSERT WITH CHECK (true);

-- Anyone can read events (for aggregation)
CREATE POLICY "Anyone can read shop events" ON shop_events
  FOR SELECT USING (true);

-- Anyone can read popularity scores
CREATE POLICY "Anyone can read shop popularity" ON shop_popularity
  FOR SELECT USING (true);

-- Service role can upsert popularity scores
CREATE POLICY "Service can manage shop popularity" ON shop_popularity
  FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════
-- Function: refresh popularity scores from events + reviews + bookmarks
-- Call this periodically (e.g., via cron or edge function)
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_shop_popularity()
RETURNS void AS $$
BEGIN
  INSERT INTO shop_popularity (shop_id, view_count, photo_view_count, bookmark_count, review_count, avg_rating, order_click_count, score, updated_at)
  SELECT
    s.id AS shop_id,
    COALESCE(ev.views, 0) AS view_count,
    COALESCE(ev.photo_views, 0) AS photo_view_count,
    COALESCE(bk.cnt, 0) AS bookmark_count,
    COALESCE(rv.cnt, 0) AS review_count,
    COALESCE(rv.avg_r, 0) AS avg_rating,
    COALESCE(ev.order_clicks, 0) AS order_click_count,
    -- Score formula: weighted sum of consumer engagement
    (
      COALESCE(ev.views, 0) * 1.0 +          -- each view = 1 pt
      COALESCE(ev.photo_views, 0) * 0.5 +     -- each photo view = 0.5 pt
      COALESCE(bk.cnt, 0) * 5.0 +             -- each bookmark = 5 pts
      COALESCE(rv.cnt, 0) * 10.0 +            -- each review = 10 pts
      COALESCE(rv.avg_r, 0) * 5.0 +           -- avg rating * 5 (max 25 pts)
      COALESCE(ev.order_clicks, 0) * 3.0       -- each order click = 3 pts
    ) AS score,
    now() AS updated_at
  FROM shops s
  LEFT JOIN (
    SELECT
      shop_id,
      COUNT(*) FILTER (WHERE event_type = 'shop_view') AS views,
      COUNT(*) FILTER (WHERE event_type = 'photo_view') AS photo_views,
      COUNT(*) FILTER (WHERE event_type = 'order_click') AS order_clicks
    FROM shop_events
    WHERE created_at > now() - INTERVAL '90 days'
    GROUP BY shop_id
  ) ev ON ev.shop_id = s.id
  LEFT JOIN (
    SELECT shop_id, COUNT(*) AS cnt
    FROM bookmarks
    GROUP BY shop_id
  ) bk ON bk.shop_id = s.id
  LEFT JOIN (
    SELECT shop_id, COUNT(*) AS cnt, AVG(rating)::numeric(3,2) AS avg_r
    FROM reviews
    GROUP BY shop_id
  ) rv ON rv.shop_id = s.id
  ON CONFLICT (shop_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    photo_view_count = EXCLUDED.photo_view_count,
    bookmark_count = EXCLUDED.bookmark_count,
    review_count = EXCLUDED.review_count,
    avg_rating = EXCLUDED.avg_rating,
    order_click_count = EXCLUDED.order_click_count,
    score = EXCLUDED.score,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Run once to initialize
SELECT refresh_shop_popularity();
