-- Add 'admin' role to profiles table
-- Run this in Supabase SQL Editor

-- If you have a CHECK constraint on the role column, update it:
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('buyer', 'seller', 'admin'));

-- Set master admin(s)
UPDATE profiles 
SET role = 'admin' 
WHERE email IN ('upsdowns.222@gmail.com', 'theh18@naver.com');
