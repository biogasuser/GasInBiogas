<?php
session_start();
header('Content-Type: application/json');

$host = 'localhost';
$user = 'root';
$password = '';
$dbname = 'gasin';

$conn = new mysqli($host, $user, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(['success' => false, 'error' => 'Database connection failed: ' . $conn->connect_error]));
}

$action = $_GET['action'] ?? '';

// Handle non-authenticated access
if ($action !== 'auth' && !isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Not authenticated', 'redirect' => true]);
    exit;
}

$user_id = $_SESSION['user_id'] ?? null;

if ($action == 'auth') {
    $data = json_decode(file_get_contents('php://input'), true);
    $type = $data['type'] ?? '';
    $username = $conn->real_escape_string($data['username'] ?? '');
    $pwd = $data['password'] ?? '';
    $package_type = $data['package_type'] ?? 'basic';
    
    if ($type == 'login') {
        $stmt = $conn->prepare("SELECT id, password FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($user = $res->fetch_assoc()) {
            if (password_verify($pwd, $user['password'])) {
                $_SESSION['user_id'] = $user['id'];
                
                if (!empty($package_type)) {
                    $upd = $conn->prepare("UPDATE users SET package_type = ? WHERE id = ?");
                    $upd->bind_param("si", $package_type, $user['id']);
                    $upd->execute();
                }

                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Invalid password']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'User not found']);
        }
    } elseif ($type == 'register') {
        $hashed = password_hash($pwd, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO users (username, password, package_type) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $username, $hashed, $package_type);
        if ($stmt->execute()) {
            $_SESSION['user_id'] = $stmt->insert_id;
            
            // create initial device settings
            $dev_stmt = $conn->prepare("INSERT INTO devices (user_id) VALUES (?)");
            $dev_stmt->bind_param("i", $_SESSION['user_id']);
            $dev_stmt->execute();
            
            // create initial mock digester state
            $dig_stmt = $conn->prepare("INSERT INTO digester_status (user_id, temperature_c, ph_level, pressure_bar, gas_production_m3, waste_level_percent, date_logged) VALUES (?, 32.0, 6.8, 1.2, 5.0, 70, CURDATE())");
            $dig_stmt->bind_param("i", $_SESSION['user_id']);
            $dig_stmt->execute();

            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Username forms an error or is taken']);
        }
    } elseif ($type == 'logout') {
        session_destroy();
        echo json_encode(['success' => true]);
    }
}
elseif ($action == 'get_dashboard') {
    $stmt_user = $conn->prepare("SELECT package_type FROM users WHERE id = ?");
    $stmt_user->bind_param("i", $user_id);
    $stmt_user->execute();
    $package_type = $stmt_user->get_result()->fetch_assoc()['package_type'] ?? 'basic';

    $stmt = $conn->prepare("SELECT temperature_c, ph_level, pressure_bar, gas_production_m3, waste_level_percent FROM digester_status WHERE user_id = ? ORDER BY date_logged DESC, id DESC LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $digester = $stmt->get_result()->fetch_assoc() ?: ['temperature_c' => 32.0, 'ph_level' => 6.8, 'pressure_bar' => 1.2, 'gas_production_m3' => 0, 'waste_level_percent' => 0];
    
    $stmt_dev = $conn->prepare("SELECT mixer_state, valve_state, mode, timer_mins FROM devices WHERE user_id = ?");
    $stmt_dev->bind_param("i", $user_id);
    $stmt_dev->execute();
    $device = $stmt_dev->get_result()->fetch_assoc() ?: ['mixer_state' => 0, 'valve_state' => 0, 'mode' => 'manual', 'timer_mins' => 0];
    
    echo json_encode([
        'success' => true,
        'package_type' => $package_type,
        'dashboard' => $digester,
        'device' => $device
    ]);
}
elseif ($action == 'set_control') {
    $data = json_decode(file_get_contents('php://input'), true);
    $control = $data['control'] ?? '';
    $value = $data['value'] ?? '';
    
    if (in_array($control, ['mixer_state', 'valve_state', 'mode', 'timer_mins'])) {
        $update_val = $conn->real_escape_string($value);
        if ($control == 'mixer_state' || $control == 'valve_state') {
            $update_val = $value ? 1 : 0;
        }
        
        $sql = "UPDATE devices SET $control = '$update_val' WHERE user_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $user_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => $conn->error]);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid control parameter']);
    }
}
elseif ($action == 'get_analytics') {
    $stmt = $conn->prepare("SELECT date_logged, gas_production_m3, ph_level, temperature_c FROM digester_status WHERE user_id = ? ORDER BY date_logged ASC LIMIT 7");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $trends = [];
    $total_gas = 0;
    while($row = $res->fetch_assoc()) {
        $trends[] = $row;
        $total_gas += $row['gas_production_m3'];
    }
    
    if(count($trends) == 0){
        $total_gas = 0; 
    }
    
    $lpg_equivalent = round($total_gas * 0.46, 2);
    
    echo json_encode([
        'success' => true,
        'trends' => $trends,
        'weekly_gas' => round($total_gas, 2),
        'lpg_equivalent' => $lpg_equivalent
    ]);
}
elseif ($action == 'get_alerts') {
    $stmt = $conn->prepare("SELECT temperature_c, ph_level, pressure_bar FROM digester_status WHERE user_id = ? ORDER BY date_logged DESC, id DESC LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $digester = $stmt->get_result()->fetch_assoc();
    
    $alerts = [];
    $recommendations = [];
    
    if ($digester) {
        if ($digester['pressure_bar'] > 2.0) {
            $alerts[] = ['type' => 'danger', 'title' => 'High Gas Pressure!', 'message' => "Pressure at {$digester['pressure_bar']} bar!"];
            $recommendations[] = "Open gas valve immediately";
        }
        if ($digester['temperature_c'] < 25.0) {
            $alerts[] = ['type' => 'warning', 'title' => 'Low Temperature!', 'message' => "Below 25°C, Check Heater!"];
            $recommendations[] = "Check heater system";
        }
        if ($digester['ph_level'] < 6.5) {
            $alerts[] = ['type' => 'warning', 'title' => 'Acidic pH Level', 'message' => "pH is {$digester['ph_level']} (Too Acidic)"];
            $recommendations[] = "Add more dry materials";
            $recommendations[] = "Reduce water input";
        }
    }
    
    // Default recommendations if no strict alert matches
    if (empty($recommendations)) {
        $recommendations[] = "Add more dry materials";
        $recommendations[] = "Reduce water input";
        $recommendations[] = "Stir the reactor now";
    }
    
    echo json_encode([
        'success' => true,
        'alerts' => $alerts,
        'recommendations' => $recommendations
    ]);
}
elseif ($action == 'get_tracking') {
    // Get total points
    $stmt = $conn->prepare("SELECT eco_points FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $total_points = $stmt->get_result()->fetch_assoc()['eco_points'] ?? 0;
    
    // Get today's waste specific to the user (mocking sensor input attributed to their chamber)
    $stmt2 = $conn->prepare("SELECT SUM(amount_kg) as today_waste, SUM(eco_points_earned) as today_points FROM waste_logs WHERE user_id = ? AND date_logged = CURDATE()");
    $stmt2->bind_param("i", $user_id);
    $stmt2->execute();
    $today_data = $stmt2->get_result()->fetch_assoc();
    
    $today_waste = $today_data['today_waste'] ?: 0;
    $today_points = $today_data['today_points'] ?: 0;
    
    // Estimation: 1kg of organic waste ~ 0.15 m3 biogas
    $estimated_gas_m3 = round($today_waste * 0.15, 2);
    
    echo json_encode([
        'success' => true, 
        'total_points' => $total_points,
        'today_waste_kg' => round($today_waste, 1),
        'today_points' => $today_points,
        'estimated_gas_m3' => $estimated_gas_m3
    ]);
}
elseif ($action == 'simulate_sensor') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!empty($data) && isset($data['amount'])) {
        $amount = (float)$data['amount'];
        $type = "Organic Waste (Manual)";
    } else {
        $amount = round(mt_rand(5, 25) / 10, 1); // Random between 0.5 and 2.5 kg
        $type = "Organic Waste (Auto-Sensor)";
    }
    
    $points_earned = floor($amount * 10); // 10 points per kg
    
    $stmt = $conn->prepare("INSERT INTO waste_logs (user_id, waste_type, amount_kg, eco_points_earned, date_logged) VALUES (?, ?, ?, ?, CURDATE())");
    $stmt->bind_param("isdi", $user_id, $type, $amount, $points_earned);
    $stmt->execute();
    
    $upd_stmt = $conn->prepare("UPDATE users SET eco_points = eco_points + ? WHERE id = ?");
    $upd_stmt->bind_param("ii", $points_earned, $user_id);
    $upd_stmt->execute();
    
    echo json_encode([
        'success' => true, 
        'added_kg' => $amount, 
        'points_earned' => $points_earned
    ]);
}
else {
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
}
$conn->close();
?>
