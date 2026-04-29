document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const authModal = document.getElementById('auth-modal');
    const mainContent = document.getElementById('main-content');
    const bottomNav = document.querySelector('.bottom-nav');
    const headerBtnLogout = document.getElementById('btn-logout');
    
    // Auth Elements
    let authMode = 'login';
    const authTitle = document.querySelector('.auth-title');
    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authError = document.getElementById('auth-error');

    // Tab Elements
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    // Dashboard Elements
    const dashTemp = document.getElementById('dash-temp');
    const dashPh = document.getElementById('dash-ph');
    const dashWaste = document.getElementById('dash-waste');
    const dashPressure = document.getElementById('dash-pressure');
    const dashGas = document.getElementById('dash-gas');
    const dashBtnMixer = document.getElementById('dash-btn-mixer');
    const dashMixerState = document.getElementById('dash-mixer-state');
    const dashBtnValve = document.getElementById('dash-btn-valve');

    // Control Elements
    const ctrlMixer = document.getElementById('ctrl-mixer');
    const ctrlTimer = document.getElementById('ctrl-timer');
    const btnValveOpen = document.getElementById('btn-valve-open');
    const btnValveClose = document.getElementById('btn-valve-close');
    const modeManual = document.getElementById('mode-manual');
    const modeAuto = document.getElementById('mode-auto');
    const iconManual = document.getElementById('icon-manual');
    const iconAuto = document.getElementById('icon-auto');

    // Alert & Reward Elements
    const alertsContainer = document.getElementById('alerts-container');
    const recsContainer = document.getElementById('recommendations-container');
    const trackTodayWaste = document.getElementById('track-today-waste');
    const trackEstGas = document.getElementById('track-est-gas');
    const trackTodayPoints = document.getElementById('track-today-points');
    const trackTotalPoints = document.getElementById('track-total-points');
    const btnSimulateSensor = document.getElementById('btn-simulate-sensor');
    const wasteFeedback = document.getElementById('waste-feedback');

    // API URL
    const API_URL = 'api.php?action=';

    // ---- STATE ----
    let currentDeviceState = {};

    // ---- Authentication Logic ----
    authSwitchLink.addEventListener('click', () => {
        authError.style.display = 'none';
        if (authMode === 'login') {
            authMode = 'register';
            authTitle.innerText = 'Create Account';
            btnLogin.style.display = 'none';
            btnRegister.style.display = 'block';
            authSwitchText.innerHTML = `Already have an account? <a id="auth-switch-link" style="color:var(--primary);cursor:pointer;font-weight:bold;">Login here</a>`;
        } else {
            authMode = 'login';
            authTitle.innerText = 'GasIn';
            btnLogin.style.display = 'block';
            btnRegister.style.display = 'none';
            authSwitchText.innerHTML = `Don't have an account? <a id="auth-switch-link" style="color:var(--primary);cursor:pointer;font-weight:bold;">Register here</a>`;
        }
        document.getElementById('auth-switch-link').addEventListener('click', authSwitchLink.click.bind(authSwitchLink));
    });

    const handleAuth = (type) => {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();
        const package_type = document.getElementById('auth-package').value;
        if (!username || !password) {
            showAuthError('Fill out all fields');
            return;
        }

        fetch(API_URL + 'auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ type, username, password, package_type })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                authModal.style.opacity = '0';
                setTimeout(() => authModal.style.display = 'none', 400);
                loadInitialData();
            } else {
                showAuthError(data.message || 'Authentication failed');
            }
        })
        .catch(err => showAuthError('Network error'));
    };

    btnLogin.addEventListener('click', () => handleAuth('login'));
    btnRegister.addEventListener('click', () => handleAuth('register'));

    headerBtnLogout.addEventListener('click', () => {
        fetch(API_URL + 'auth', {
            method: 'POST',
            body: JSON.stringify({type: 'logout'})
        }).then(() => location.reload());
    });

    const showAuthError = (msg) => {
        authError.innerText = msg;
        authError.style.display = 'block';
    }

    // ---- Tab Switching Logic ----
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            const target = item.getAttribute('data-target');
            item.classList.add('active');
            
            const targetEl = document.getElementById(target);
            if(targetEl) targetEl.classList.add('active');

            if (target === 'tab-dashboard') fetchDashboard();
            if (target === 'tab-control') fetchControlState();
            if (target === 'tab-analytics') fetchAnalytics();
            if (target === 'tab-settings') fetchAnalytics();
            if (target === 'tab-alerts') { fetchAlerts(); fetchTracking(); }
        });
    });

    // ---- Toast Notification ----
    const showToast = (message) => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ---- Fetch Data Logic ----
    const req = async (action, options = {}) => {
        const res = await fetch(API_URL + action, options);
        const data = await res.json();
        if (data.redirect) {
            authModal.style.display = 'flex';
            authModal.style.opacity = '1';
        }
        return data;
    }

    const loadInitialData = () => {
        fetchDashboard();
        // pre-fetch alerts to check if there are danger warnings
        fetchAlerts(true);
    };

    const fetchDashboard = () => {
        req('get_dashboard').then(data => {
            if (data.success) {
                const { dashboard, device, package_type } = data;
                
                // Update elements
                const dashTempEls = document.querySelectorAll('.dash-temp');
                const dashPhEls = document.querySelectorAll('.dash-ph');
                const dashWasteEls = document.querySelectorAll('.dash-waste');
                const dashPressureEls = document.querySelectorAll('.dash-pressure');
                
                dashTempEls.forEach(el => el.innerText = dashboard.temperature_c + '°C');
                dashPhEls.forEach(el => el.innerText = dashboard.ph_level);
                dashWasteEls.forEach(el => el.innerText = dashboard.waste_level_percent + '%');
                dashPressureEls.forEach(el => el.innerText = dashboard.pressure_bar + ' bar');
                
                document.getElementById('dash-gas').innerText = dashboard.gas_production_m3 + ' m³';
                document.getElementById('dash-lpg').innerText = (dashboard.gas_production_m3 * 0.46).toFixed(1);
                
                document.getElementById('dash-waste-basic').innerText = dashboard.waste_level_percent + '%';
                document.getElementById('dash-waste-bar').style.width = dashboard.waste_level_percent + '%';

                currentDeviceState = device;
                updateControlUI();
                
                // Switch UI by Package
                applyPackageUI(package_type);
            }
        });
    };

    const applyPackageUI = (pkg) => {
        const wStat = document.getElementById('widget-status');
        const wAi = document.getElementById('widget-ai-health');
        const wGas = document.getElementById('widget-gas-production');
        const wBin = document.getElementById('widget-smart-bin');
        const wEst = document.getElementById('widget-estimasi');
        const wBasDig = document.getElementById('widget-basic-digester');
        const wInpManual = document.getElementById('widget-input-manual');
        const wTips = document.getElementById('widget-tips');
        const wKpi = document.getElementById('widget-kpi-grid');
        const wKpiSmart = document.getElementById('widget-kpi-smart');
        const ctrlTimer = document.getElementById('ctrl-auto-timer');
        const ctrlMode = document.getElementById('ctrl-auto-mode');

        const navAnalytics = document.getElementById('nav-analytics');
        const navAnalyticsTxt = document.getElementById('nav-analytics-text');
        const navTracking = document.getElementById('nav-tracking');

        // Reset visibility
        wAi.style.display = pkg === 'smart' ? 'block' : 'none';
        wBin.style.display = pkg === 'smart' ? 'flex' : 'none';
        wEst.style.display = pkg === 'smart' ? 'block' : 'none';
        wBasDig.style.display = pkg === 'basic' ? 'block' : 'none';
        wInpManual.style.display = (pkg === 'basic' || pkg === 'eco') ? 'block' : 'none';
        wTips.style.display = pkg === 'basic' ? 'block' : 'none';
        wKpi.style.display = pkg === 'eco' ? 'block' : 'none';
        wKpiSmart.style.display = pkg === 'smart' ? 'flex' : 'none';

        // Apply Layout Order
        if (pkg === 'basic') {
            wStat.style.order = 1;
            wGas.style.order = 2;
            wBasDig.style.order = 3;
            wInpManual.style.order = 4;
            wEst.style.order = 5;
            wTips.style.order = 6;
        } else if (pkg === 'eco') {
            wStat.style.order = 1;
            wKpi.style.order = 2;
            wGas.style.order = 3;
            wInpManual.style.order = 4;
            wEst.style.order = 5;
        } else if (pkg === 'smart') {
            wStat.style.order = 1;
            wGas.style.order = 2;
            wBin.style.order = 3;
            wEst.style.order = 4;
            wKpiSmart.style.order = 5;
        }

        if(ctrlTimer) ctrlTimer.style.display = pkg === 'basic' ? 'none' : 'flex';
        if(ctrlMode) ctrlMode.style.display = pkg === 'basic' ? 'none' : 'block';

        if(pkg === 'basic') {
            navAnalytics.style.display = 'flex';
            navAnalyticsTxt.innerText = 'History';
            navTracking.style.display = 'none';
        } else if (pkg === 'eco') {
            navAnalytics.style.display = 'flex';
            navAnalyticsTxt.innerText = 'Analytics';
            navTracking.style.display = 'none';
        } else if (pkg === 'smart') {
            navAnalytics.style.display = 'flex';
            navAnalyticsTxt.innerText = 'Analytics';
            navTracking.style.display = 'flex';
        }
    }

    const fetchControlState = () => {
        req('get_dashboard').then(data => {
            if (data.success) {
                currentDeviceState = data.device;
                updateControlUI();
            }
        });
    }

    const updateControlUI = () => {
        if(!currentDeviceState) return;
        
        // Mixer
        ctrlMixer.checked = currentDeviceState.mixer_state == 1;
        dashMixerState.innerText = currentDeviceState.mixer_state == 1 ? 'ON' : 'OFF';

        if (currentDeviceState.mixer_state == 1) {
            dashBtnMixer.classList.add('btn-active-primary');
            dashBtnMixer.classList.remove('btn-inactive-grey');
            dashBtnMixer.style.backgroundColor = 'var(--primary)';
        } else {
            dashBtnMixer.classList.add('btn-inactive-grey');
            dashBtnMixer.classList.remove('btn-active-primary');
            dashBtnMixer.style.backgroundColor = '#95A5A6';
        }

        // Valve
        if (currentDeviceState.valve_state == 1) {
            btnValveOpen.classList.add('btn-active-primary');
            btnValveOpen.classList.remove('btn-inactive-grey');
            btnValveClose.classList.add('btn-inactive-grey');
            btnValveClose.classList.remove('btn-inactive-red');
            dashBtnValve.style.backgroundColor = 'var(--primary)';
            dashBtnValve.querySelector('small').innerText = 'Open';
        } else {
            btnValveOpen.classList.add('btn-inactive-grey');
            btnValveOpen.classList.remove('btn-active-primary');
            btnValveClose.classList.add('btn-inactive-red');
            btnValveClose.classList.remove('btn-inactive-grey');
            dashBtnValve.style.backgroundColor = '#1565C0';
            dashBtnValve.querySelector('small').innerText = 'Closed';
        }

        // Mode
        if (currentDeviceState.mode === 'auto') {
            modeAuto.classList.add('active');
            modeManual.classList.remove('active');
            iconAuto.style.color = 'var(--primary)';
            iconManual.style.color = 'inherit';
        } else {
            modeManual.classList.add('active');
            modeAuto.classList.remove('active');
            iconManual.style.color = 'var(--primary)';
            iconAuto.style.color = 'inherit';
        }
    }

    // ---- Control Actions ----
    const setControlObj = (control, value) => {
        req('set_control', {
            method: 'POST',
            body: JSON.stringify({control, value})
        }).then(res => {
            if (res.success) {
                showToast(`Updated ${control} to ${value}`);
                fetchControlState();
            }
        });
    }

    ctrlMixer.addEventListener('change', (e) => setControlObj('mixer_state', e.target.checked));
    
    ctrlTimer.addEventListener('change', (e) => setControlObj('timer_mins', e.target.value));

    btnValveOpen.addEventListener('click', () => setControlObj('valve_state', true));
    btnValveClose.addEventListener('click', () => setControlObj('valve_state', false));

    // Dashboard Mirror Actions
    dashBtnMixer.addEventListener('click', () => setControlObj('mixer_state', currentDeviceState.mixer_state == 1 ? false : true));
    dashBtnValve.addEventListener('click', () => setControlObj('valve_state', currentDeviceState.valve_state == 1 ? false : true));

    modeManual.addEventListener('click', () => setControlObj('mode', 'manual'));
    modeAuto.addEventListener('click', () => setControlObj('mode', 'auto'));

    // ---- Analytics ----
    let gasChartInstance = null;
    let phChartInstance = null;
    let miniChartInstance = null;

    const fetchAnalytics = () => {
        req('get_analytics').then(data => {
            if (data.success) {
                if (document.getElementById('chart-gas-total')) {
                    document.getElementById('chart-gas-total').innerHTML = `${data.weekly_gas} m&sup3;`;
                }
                if (document.getElementById('chart-lpg-eq')) {
                    document.getElementById('chart-lpg-eq').innerHTML = `LPG Equivalent: ${data.lpg_equivalent} kg`;
                }

                renderCharts(data.trends);
            }
        });
    }

    const renderCharts = (trends) => {
        const labels = trends.map(t => {
            let d = new Date(t.date_logged);
            return d.getDate() + '/' + (d.getMonth() + 1);
        });
        const gasData = trends.map(t => parseFloat(t.gas_production_m3));

        // Digester Monitor Chart -> Gas Production
        const gasCtx = document.getElementById('gasProductionChart');
        if (gasCtx) {
            if (gasChartInstance) gasChartInstance.destroy();
            gasChartInstance = new Chart(gasCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: 'line',
                            label: 'Trend',
                            data: gasData,
                            borderColor: '#388E3C', // Green line
                            backgroundColor: '#388E3C',
                            fill: false,
                            tension: 0.4
                        },
                        {
                            type: 'bar',
                            label: 'Volume',
                            data: gasData,
                            backgroundColor: 'rgba(76, 175, 80, 0.5)',
                            borderRadius: 4
                        }
                    ]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: {legend: {display: false}},
                    scales: {
                        x: { display: true, grid: {display: false} },
                        y: { display: true, beginAtZero: true, grid: {color: '#f0f0f0'} }
                    }
                }
            });
        }

        // Setup the mini chart in the dashboard
        const miniCtx = document.getElementById('miniDashboardChart');
        if (miniCtx) {
            if (miniChartInstance) miniChartInstance.destroy();
            miniChartInstance = new Chart(miniCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        data: gasData,
                        backgroundColor: '#1976D2',
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {legend: {display: false}, tooltip: {enabled: false}},
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    }
                }
            });
        }

        // pH and Temperature Chart
        const phTempCtx = document.getElementById('phTempChart');
        if (phTempCtx) {
            if (phChartInstance) phChartInstance.destroy();
            
            const phData = trends.map(t => parseFloat(t.ph_level));
            const tempData = trends.map(t => parseFloat(t.temperature_c));

            phChartInstance = new Chart(phTempCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'pH',
                            data: phData,
                            borderColor: '#FF9800',
                            backgroundColor: 'rgba(255, 152, 0, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Temperature (°C)',
                            data: tempData,
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {legend: {display: false}},
                    scales: {
                        x: { display: true, grid: {display: false} },
                        y: { 
                            display: true, 
                            position: 'left',
                            grid: {color: '#f0f0f0'},
                            suggestedMin: 6, suggestedMax: 8
                        },
                        y1: { 
                            display: false, 
                            position: 'right',
                            grid: {display: false},
                            suggestedMin: 20, suggestedMax: 45
                        }
                    }
                }
            });
        }
    }

    // ---- Alerts & Rewards ----
    const fetchAlerts = (silent = false) => {
        req('get_alerts').then(data => {
            if (data.success) {
                // Render Alerts
                if (data.alerts.length === 0) {
                    alertsContainer.innerHTML = `<div class="alert-box" style="background:#2ecc71;">
                        <div class="alert-icon"><i class="fa-solid fa-check-circle"></i></div>
                        <div class="alert-text"><h4>All Systems Healthy</h4><p>No critical actions required.</p></div>
                    </div>`;
                } else {
                    alertsContainer.innerHTML = data.alerts.map(a => `
                        <div class="alert-box ${a.type}">
                            <div class="alert-icon"><i class="fa-solid ${a.type==='danger'?'fa-triangle-exclamation':'fa-circle-exclamation'}"></i></div>
                            <div class="alert-text"><h4>${a.title}</h4><p>${a.message}</p></div>
                        </div>
                    `).join('');
                    
                    if(silent && data.alerts.some(a => a.type === 'danger')) {
                        showToast(`System Alert: ${data.alerts[0].title}`);
                    }
                }

                // Render Recs
                recsContainer.innerHTML = data.recommendations.map(r => `
                    <li><i class="fa-solid fa-circle-check"></i> ${r}</li>
                `).join('');
            }
        });
    }

    const fetchTracking = () => {
        req('get_tracking').then(data => {
            if (data.success) {
                if(trackTodayWaste) trackTodayWaste.innerText = data.today_waste_kg;
                if(trackEstGas) trackEstGas.innerText = data.estimated_gas_m3;
                if(trackTodayPoints) trackTodayPoints.innerText = data.today_points;
                if(trackTotalPoints) trackTotalPoints.innerText = data.total_points;
                
                const dashEco = document.getElementById('dash-eco-points');
                if(dashEco) dashEco.innerText = data.total_points;
            }
        });
    }

    if(btnSimulateSensor) {
        btnSimulateSensor.addEventListener('click', () => {
            req('simulate_sensor', { method: 'POST' }).then(data => {
                if (data.success) {
                    wasteFeedback.style.display = 'block';
                    wasteFeedback.innerHTML = `IoT Sensor detected <b>+${data.added_kg} kg</b> waste!<br>+${data.points_earned} Eco Points awarded.`;
                    fetchTracking();
                    setTimeout(() => { wasteFeedback.style.display='none'; }, 4000);
                }
            });
        });
    }

    const btnManualSimpan = document.getElementById('btn-manual-simpan');
    if(btnManualSimpan) {
        btnManualSimpan.addEventListener('click', () => {
            const val = parseFloat(document.getElementById('manual-waste-input').value);
            if (isNaN(val) || val <= 0) {
                showToast('Masukkan berat limbah yang valid');
                return;
            }
            req('simulate_sensor', { method: 'POST', body: JSON.stringify({ amount: val }) }).then(data => {
                 if (data.success) {
                     showToast(`Tersimpan! +${data.points_earned} Eco Points`);
                     
                     // Show Estimasi
                     const m3 = (val * 0.15).toFixed(2);
                     const lpg = (val * 0.07).toFixed(2);
                     
                     const wEst = document.getElementById('widget-estimasi');
                     wEst.style.display = 'block';
                     wEst.innerHTML = `<span style="font-weight: 700; font-size: 13px; display: block; margin-bottom: 5px; color: var(--text-muted);">Estimasi Potensi Biogas (Limbah Baru)</span>
                     <div style="font-size:18px; font-weight:700; color:var(--text-main);">${m3} m&sup3; <span style="font-size:13px; color:var(--primary); font-weight:600; margin-left:10px;">≈ ${lpg} kg LPG</span></div>`;
                     
                     document.getElementById('manual-waste-input').value = '';
                     fetchTracking();
                 }
            });
        });
    }

    // Check if authenticated on load
    req('get_dashboard').then(data => {
        if(data.success) {
            authModal.style.display = 'none';
            loadInitialData();
            fetchAnalytics(); // Force fetch to construct mini chart on dashboard
            fetchTracking(); // Fetch tracking for Eco Points
            
            // Polling for dashboard
            setInterval(() => {
                if(document.getElementById('tab-dashboard').classList.contains('active')) {
                    fetchDashboard();
                }
            }, 5000);
        } else {
            authModal.style.display = 'flex';
        }
    });
});
