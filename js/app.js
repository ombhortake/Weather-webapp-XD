// Constants
const API_BASE = 'https://api.open-meteo.com/v1';
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const UNIT_TOGGLES = document.querySelectorAll('.btn-group button');
const LOCATION_INPUT = document.getElementById('locationSearch');
const CURRENT_CARD = document.querySelector('.weather-card');
const HOURLY_CANVAS = document.getElementById('hourlyChart');
const DAILY_CONTAINER = document.querySelector('.row.g-3');

// State management
let currentData = {};
let activeUnit = 'C';
let hourlyChart;

// Debounced search handler
let searchTimeout;
LOCATION_INPUT.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (e.target.value.length >= 3) {
      resetUI();
      fetchLocation(e.target.value);
    }
  }, 300);
});

// Unit conversion functions
const celsiusToFahrenheit = (c) => (c ? (c * 9/5 + 32).toFixed(1) : '-');
const mmToInches = (mm) => (mm ? (mm / 25.4).toFixed(2) : '-');

// Geocoding API call
async function fetchLocation(query) {
  try {
    showLoadingState();
    const response = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!data.results?.length) {
      throw new Error('No location found');
    }
    
    const { latitude, longitude, name } = data.results[0];
    await fetchWeatherData(latitude, longitude, name);
    
  } catch (error) {
    console.error('Location error:', error);
    showError('Failed to find location');
  }
}

// Main weather data fetch
async function fetchWeatherData(lat, lon, locationName) {
  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      timezone: 'auto',
      current_weather: true,
      hourly: 'temperature_2m,apparent_temperature,precipitation,weathercode,uv_index',
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
    });
    
    const response = await fetch(`${API_BASE}/forecast?${params}`);
    currentData = await response.json();
    currentData.locationName = locationName;
    
    if (!currentData.current_weather) {
      throw new Error('Incomplete weather data');
    }
    
    renderAll();
    
  } catch (error) {
    console.error('Weather API error:', error);
    showError('Failed to retrieve weather data');
  }
}

// Unified rendering function
function renderAll() {
  renderCurrentWeather();
  renderHourlyChart();
  renderDailyForecast();
  updateNavbarTitle();
}

// Current weather rendering
function renderCurrentWeather() {
  if (!currentData.current_weather) return showError('No current weather data');
  
  const { current_weather, hourly } = currentData;
  const currentTimeIndex = hourly.time.findIndex(t => t === current_weather.time);
  const uvIndex = hourly.uv_index?.[currentTimeIndex] || '-';
  
  CURRENT_CARD.querySelector('.card-body').innerHTML = `
    <div class="d-flex flex-column align-items-center">
      <h2 class="display-4 mb-3">${formatTemp(current_weather.temperature)}</h2>
      <div class="d-flex justify-content-around w-100 mb-3">
        <div>Feels like: ${formatTemp(hourly.apparent_temperature[currentTimeIndex])}</div>
        <div>Precipitation: ${formatPrecip(hourly.precipitation[currentTimeIndex])}</div>
      </div>
      <div class="w-100 d-flex justify-content-between">
        <div>
          <div>Wind: ${formatWind(current_weather.windspeed)}</div>
          <div>UV Index: ${uvIndex}</div>
        </div>
        <div class="text-end">
          <div>High: ${formatTemp(currentData.daily.temperature_2m_max[0])}</div>
          <div>Low: ${formatTemp(currentData.daily.temperature_2m_min[0])}</div>
        </div>
      </div>
    </div>
  `;
}

// Hourly chart rendering
function renderHourlyChart() {
  if (!currentData.hourly) return;
  if (hourlyChart) hourlyChart.destroy();

  const next24Hours = currentData.hourly.time.slice(0, 24);
  
  hourlyChart = new Chart(HOURLY_CANVAS, {
    type: 'line',
    data: {
      labels: next24Hours.map(t => new Date(t).toLocaleTimeString([], {hour: 'numeric'})),
      datasets: [{
        label: 'Temperature',
        data: next24Hours.map((t, i) => 
          activeUnit === 'C' 
            ? currentData.hourly.temperature_2m[i] 
            : celsiusToFahrenheit(currentData.hourly.temperature_2m[i])
        ),
        borderColor: 'rgba(103, 80, 164, 0.8)',
        backgroundColor: 'rgba(103, 80, 164, 0.2)',
        yAxisID: 'temp',
      }, {
        label: 'Precipitation',
        data: next24Hours.map((t, i) => 
          activeUnit === 'C' 
            ? currentData.hourly.precipitation[i] 
            : mmToInches(currentData.hourly.precipitation[i])
        ),
        type: 'bar',
        borderColor: 'rgba(234, 221, 255, 0.8)',
        backgroundColor: 'rgba(234, 221, 255, 0.4)',
        yAxisID: 'precip',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw;
              return `${context.dataset.label}: ${value}${context.dataset.yAxisID === 'temp' ? `°${activeUnit}` : ''}`;
            }
          }
        }
      },
      scales: {
        temp: {
          type: 'linear',
          position: 'left',
          ticks: { color: 'rgba(103, 80, 164, 0.8)' }
        },
        precip: {
          type: 'linear',
          position: 'right',
          ticks: { color: 'rgba(234, 221, 255, 0.8)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// Daily forecast rendering
function renderDailyForecast() {
  if (!currentData.daily) {
    DAILY_CONTAINER.innerHTML = `
      <div class="col-12 text-center">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
    `;
    return;
  }

  DAILY_CONTAINER.innerHTML = currentData.daily.time.map((date, index) => `
    <div class="col-md-6 col-lg-4">
      <div class="card daily-card rounded-3 mb-3">
        <div class="card-body">
          <h5 class="card-title">${new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</h5>
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="display-6">${formatTemp(currentData.daily.temperature_2m_max[index])}</span>
              <span class="text-secondary ms-2">${formatTemp(currentData.daily.temperature_2m_min[index])}</span>
            </div>
            <div class="ms-3">${formatPrecip(currentData.daily.precipitation_sum[index])}</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// UI state management
function resetUI() {
  currentData = {};
  DAILY_CONTAINER.innerHTML = '';
  if (hourlyChart) hourlyChart.destroy();
  CURRENT_CARD.querySelector('.card-body').innerHTML = '';
}

function showLoadingState() {
  CURRENT_CARD.querySelector('.card-body').innerHTML = `
    <div class="d-flex justify-content-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>
  `;
  DAILY_CONTAINER.innerHTML = `
    <div class="col-12 text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>
  `;
}

function showError(message) {
  CURRENT_CARD.querySelector('.card-body').innerHTML = `
    <div class="alert alert-danger">${message}</div>
  `;
  DAILY_CONTAINER.innerHTML = '';
}

// Navbar title update
function updateNavbarTitle() {
  document.querySelector('.navbar-brand').textContent = 
    `${currentData.locationName || 'Weather'} Dashboard`;
}

// Unit toggle handlers
UNIT_TOGGLES.forEach(btn => {
  btn.addEventListener('click', () => {
    activeUnit = btn.textContent.trim().replace('°', '');
    UNIT_TOGGLES.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAll();
  });
});

// Formatting helpers
function formatTemp(temp) {
  if (temp === null || temp === undefined) return '-';
  return activeUnit === 'C' 
    ? `${temp.toFixed(1)}°C` 
    : `${celsiusToFahrenheit(temp)}°F`;
}

function formatPrecip(precip) {
  if (precip === null || precip === undefined) return '-';
  return activeUnit === 'C' 
    ? `${precip.toFixed(1)} mm` 
    : `${mmToInches(precip)} in`;
}

function formatWind(speed) {
  if (speed === null || speed === undefined) return '-';
  return activeUnit === 'C' 
    ? `${speed.toFixed(1)} m/s` 
    : `${(speed * 2.23694).toFixed(1)} mph`;
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      fetchWeatherData(
        position.coords.latitude,
        position.coords.longitude,
        'Current Location'
      );
    }, () => showError('Geolocation permission denied'));
  }
});
function toggleTheme() {
  const theme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', theme);
}