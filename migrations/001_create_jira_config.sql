-- Migration 001: Create jira_config table
-- Run once against jira_db before starting the backend.
-- This is a single-row config table. id=1 is always the active config.
-- ON DUPLICATE KEY UPDATE means re-configuring replaces the existing row.

CREATE DATABASE IF NOT EXISTS jira_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE jira_db;

CREATE TABLE IF NOT EXISTS jira_config (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  base_url              VARCHAR(500) NOT NULL,
  email                 VARCHAR(255) NOT NULL,
  api_token_encrypted   TEXT         NOT NULL,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP
);
