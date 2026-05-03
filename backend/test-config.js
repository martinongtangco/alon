// Test script for Platform Config functionality

const { pool } = require('./src/db');
const http = require('http');
const express = require('express');

async function testConfig() {
  try {
    // Create a basic server to test the routes
    const app = express();
    app.use(express.json());
    
    console.log("Testing Platform Config module...");
    
    // Test creating default config entries if they don't exist
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS admin;
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin.platform_config (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB,
        tier VARCHAR(50),
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by TEXT
      );
    `);

    // Insert default config values if table is empty
    const countResult = await pool.query('SELECT COUNT(*) FROM admin.platform_config');
    
    if (parseInt(countResult.rows[0].count) === 0) {
      console.log("Creating default configuration entries...");
      
      await pool.query(`
        INSERT INTO admin.platform_config (key, value, tier)
        VALUES 
          ('BLE_SCAN_INTERVAL', '{"value": 15}', 'hot'),
          ('BUZZ_COOLDOWN', '{"value": 60}', 'hot'),
          ('MAX_PROMO_RADIUS', '{"value": 2000}', 'hot'),
          ('AUTO_FLAG_THRESHOLD', '{"value": 3}', 'hot'),
          ('FEATURE_FLAGS', '{"buzz_me": true, "mutual_reveal": true}', 'hot')
        ON CONFLICT (key) DO NOTHING
      `);
      
      console.log("Default configuration entries created successfully");
    }
    
    // Verify the config was inserted
    const result = await pool.query('SELECT key, value FROM admin.platform_config ORDER BY key ASC');
    console.log("Current Configuration:");
    result.rows.forEach(row => {
      console.log(`  ${row.key}: ${JSON.stringify(JSON.parse(row.value))}`);
    });
    
    console.log("\nPlatform Config module test completed successfully!");
    
  } catch (error) {
    console.error('Error in config test:', error);
  }
}

testConfig();