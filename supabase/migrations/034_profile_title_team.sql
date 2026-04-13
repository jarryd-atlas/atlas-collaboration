-- Add title and team fields to profiles for user management
ALTER TABLE profiles
  ADD COLUMN title text,
  ADD COLUMN team  text;
