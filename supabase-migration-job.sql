-- Migration: Add job column to profiles
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job text DEFAULT '';
