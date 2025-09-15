// Constants
const API_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const UNIT_BUTTONS = document.querySelectorAll('.btn-group button');
const START_DATE = document.getElementById('start_date');
const END_DATE = document.getElementById('end_date');
const ANALYZE_BTN = document.getElementById('analyzeButton');
const CITY_SEARCH = document.getElementById('citySearch');
const SEARCH_BTN = document.getElementById('searchButton');

// State management
let historicalData = {};
let activeUnit = 'C';
let location = JSON.parse(localStorage.getItem('weatherLocation')) || {};
let charts = { temp: null, wind: null, thermal: null };

// DOM elements for stats
const STATS = {
    maxTemp: document.getElementById('maxTemp'),
    minTemp: document.getElementById('minTemp'),
    totalRain: document.getElementById('totalRain'),
    maxWind: document.getElementById('maxWind')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates (last 7 days)
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 7);
    
    START_DATE.value = pastDate.toISOString().split('T')[0];
    END_DATE.value = today.toISOString().split('T')[0];
    
    // Update location display
    updateLocationDisplay();
    
    // If no location, set to Berlin
    if (!location.name) {
        testBerlinData();
    }
    
    // Add event listeners
    ANALYZE_BTN.addEventListener('click', fetchHistoricalData);
    UNIT_BUTTONS.forEach(btn => btn.addEventListener('click', handleUnitToggle));
    SEARCH_BTN.addEventListener('click', handleSearch);
    CITY_SEARCH.addEventListener('keypress', handleSearchKeypress);
});

// Handle search button click
async function handleSearch() {
    const city = CITY_SEARCH.value.trim();
    if (city) {
        try {
            await getLocation(city);
            updateLocationDisplay();
        } catch (error) {
            showError('Location not found');
        }
    }
}

// Handle Enter key press in search input
async function handleSearchKeypress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        await handleSearch();
    }
}

// Update location display in navbar
function updateLocationDisplay() {
    const navbarBrand = document.querySelector('.navbar-brand');
    navbarBrand.textContent = `Historical Analysis - ${location.name || 'Unknown'}`;
}

// Test Berlin data (default location)
async function testBerlinData() {
    try {
        await getLocation('Berlin');
        updateLocationDisplay();
        await fetchHistoricalData(); // Fetch data for Berlin on first load
    } catch (error) {
        showError('Failed to load default location data');
    }
}

// Fetch location coordinates using geocoding API
async function getLocation(city) {
    const response = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(city)}&count=1`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
        throw new Error('City not found');
    }
    const { latitude, longitude, name } = data.results[0];
    location = { latitude, longitude, name };
    localStorage.setItem('weatherLocation', JSON.stringify(location));
}

// Main data fetch for historical weather
async function fetchHistoricalData() {
    try {
        showLoading();
        
        // Date validation
        const startDate = new Date(START_DATE.value);
        const endDate = new Date(END_DATE.value);
        const today = new Date();

        if (isNaN(startDate) || isNaN(endDate)) {
            throw new Error('Please select valid dates');
        }
        
        if (endDate >= today) {
            throw new Error('Data only available until yesterday');
        }
        
        if ((endDate - startDate) > 31536000000) { // 365 days
            throw new Error('Maximum date range is 1 year');
        }

        // Location check
        if (!location.latitude) {
            throw new Error('Please search for a location using the search bar');
        }

        // Build API request
        const params = new URLSearchParams({
            latitude: location.latitude,
            longitude: location.longitude,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant',
            timezone: 'auto'
        });

        const response = await fetch(API_ARCHIVE + '?' + params);
        const data = await response.json();

        // Validate response
        if (data.error) throw new Error(data.error);
        if (!data.daily) throw new Error('No historical data available');

        historicalData = data;
        updateAllDisplays();

    } catch (error) {
        showError(error.message);
        console.error('API Error:', error);
    } finally {
        hideLoading();
    }
}

// Update all displays (stats and charts)
function updateAllDisplays() {
    updateStats();
    renderTemperatureChart();
    renderWindRose();
    renderThermalAmplitude();
}

// Render temperature trends chart
function renderTemperatureChart() {
    const ctx = document.getElementById('tempChart');
    if (!ctx) return;

    if (charts.temp) charts.temp.destroy();
    
    const labels = historicalData.daily.time.map(date => 
        new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    charts.temp = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Max Temperature',
                    data: historicalData.daily.temperature_2m_max.map(t => convertTempToActiveUnit(t)),
                    borderColor: '#DC3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.2)',
                    tension: 0.4
                },
                {
                    label: 'Min Temperature',
                    data: historicalData.daily.temperature_2m_min.map(t => convertTempToActiveUnit(t)),
                    borderColor: '#1C9BF6',
                    backgroundColor: 'rgba(28, 155, 246, 0.2)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => 
                            `${context.dataset.label}: ${context.raw}°${activeUnit}`
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Temperature (°)' }
                }
            }
        }
    });
}

// Render wind rose chart
function renderWindRose() {
    const ctx = document.getElementById('windRose');
    if (!ctx) return;

    if (charts.wind) charts.wind.destroy();
    
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const windData = historicalData.daily.wind_direction_10m_dominant.map(deg => 
        directions[Math.round(deg / 45) % 8]
    );
    
    const counts = directions.map(dir => 
        windData.filter(d => d === dir).length
    );

    charts.wind = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: directions,
            datasets: [{
                label: 'Wind Direction',
                data: counts,
                backgroundColor: [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
                    '#FFEEAD', '#FF9A9E', '#FAD0C4', '#A1C4FD'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

// Render thermal amplitude chart
function renderThermalAmplitude() {
    const ctx = document.getElementById('thermalChart');
    if (!ctx) return;

    if (charts.thermal) charts.thermal.destroy();
    
    const amplitudes = historicalData.daily.temperature_2m_max
        .map((max, i) => max - historicalData.daily.temperature_2m_min[i]);

    charts.thermal = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: historicalData.daily.time.map(date => 
                new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
            ),
            datasets: [{
                label: 'Daily Temperature Range',
                data: amplitudes.map(a => convertRangeToActiveUnit(a)),
                backgroundColor: 'rgba(103, 80, 164, 0.6)',
                borderColor: '#6750A4',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => 
                            `Range: ${context.raw}°${activeUnit}`
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Temperature Range (°)' }
                }
            }
        }
    });
}

// UI state management
function showLoading() {
    document.querySelectorAll('.chart-container').forEach(container => {
        container.querySelector('.loading-overlay').classList.remove('d-none');
        container.querySelector('.error-overlay').classList.add('d-none');
    });
}

function hideLoading() {
    document.querySelectorAll('.chart-container').forEach(container => {
        container.querySelector('.loading-overlay').classList.add('d-none');
    });
}

function showError(message) {
    document.querySelectorAll('.chart-container').forEach(container => {
        container.querySelector('.loading-overlay').classList.add('d-none');
        const errorDiv = container.querySelector('.error-overlay');
        errorDiv.querySelector('p').textContent = message;
        errorDiv.classList.remove('d-none');
    });
}

// Unit toggle
function handleUnitToggle(e) {
    activeUnit = e.target.getAttribute('data-unit');
    UNIT_BUTTONS.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-unit') === activeUnit));
    updateAllDisplays();
}

// Conversion functions
function convertTempToActiveUnit(temp) {
    return activeUnit === 'C' ? temp : (temp * 9 / 5) + 32;
}

function convertRangeToActiveUnit(range) {
    return activeUnit === 'C' ? range : range * 9 / 5;
}

// Update statistics
function updateStats() {
    const maxTemp = Math.max(...historicalData.daily.temperature_2m_max);
    const minTemp = Math.min(...historicalData.daily.temperature_2m_min);
    const totalRain = historicalData.daily.precipitation_sum.reduce((a, b) => a + b, 0);
    const maxWind = Math.max(...historicalData.daily.wind_speed_10m_max);

    STATS.maxTemp.textContent = `${convertTempToActiveUnit(maxTemp).toFixed(1)}°${activeUnit}`;
    STATS.minTemp.textContent = `${convertTempToActiveUnit(minTemp).toFixed(1)}°${activeUnit}`;
    STATS.totalRain.textContent = `${totalRain.toFixed(1)} mm`;
    STATS.maxWind.textContent = `${maxWind.toFixed(1)} m/s`;
}