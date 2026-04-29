CREATE DATABASE IF NOT EXISTS gasin;
USE gasin;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    package_type ENUM('basic', 'eco', 'smart') DEFAULT 'basic',
    eco_points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mixer_state BOOLEAN DEFAULT FALSE,
    valve_state BOOLEAN DEFAULT FALSE,
    mode ENUM('manual', 'auto') DEFAULT 'manual',
    timer_mins INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS digester_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    temperature_c DECIMAL(5,2) NOT NULL,
    ph_level DECIMAL(4,2) NOT NULL,
    pressure_bar DECIMAL(5,2) NOT NULL,
    gas_production_m3 DECIMAL(5,2) NOT NULL,
    waste_level_percent INT NOT NULL,
    date_logged DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS waste_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    waste_type VARCHAR(50) NOT NULL,
    amount_kg DECIMAL(5,2) NOT NULL,
    eco_points_earned INT DEFAULT 0,
    date_logged DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mock Data for demonstration purposes
INSERT INTO users (id, username, password, package_type, eco_points) VALUES 
(1, 'demo', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'eco', 150); -- password is 'password'

INSERT INTO devices (user_id, mixer_state, valve_state, mode, timer_mins) VALUES 
(1, TRUE, FALSE, 'manual', 10);

-- Mock Data for digester_status (7 days trajectory, up and down)
INSERT INTO digester_status (user_id, temperature_c, ph_level, pressure_bar, gas_production_m3, waste_level_percent, date_logged) VALUES
(1, 32.5, 6.8, 1.2, 5.2, 75, CURDATE()),
(1, 31.8, 6.4, 0.8, 2.1, 73, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
(1, 33.2, 7.1, 1.9, 7.5, 78, DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
(1, 30.5, 6.2, 0.6, 1.3, 70, DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
(1, 34.0, 7.3, 1.8, 8.2, 85, DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
(1, 31.1, 6.5, 0.9, 3.5, 74, DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
(1, 32.8, 7.0, 1.5, 6.8, 78, DATE_SUB(CURDATE(), INTERVAL 6 DAY));

-- Mock Data for waste_logs
INSERT INTO waste_logs (user_id, waste_type, amount_kg, eco_points_earned, date_logged) VALUES 
(1, 'Food Waste', 2.5, 25, CURDATE()),
(1, 'Fruit Peels', 1.2, 12, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
(1, 'Vegetables', 3.0, 30, DATE_SUB(CURDATE(), INTERVAL 2 DAY));
