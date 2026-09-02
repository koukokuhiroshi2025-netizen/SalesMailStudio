UPDATE settings
SET value = '500', updated_at = datetime('now')
WHERE user_id = 'demo-user' AND setting_key = 'max_batch_size';
