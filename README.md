# Weather Dashboard

This is a simple yet powerful web application built with HTML, CSS, and JavaScript that provides current weather conditions and historical temperature trends for locations around the world. It utilizes the free and open-source **Open-Meteo API** to fetch accurate weather data.

-----

### Key Features

  * **Current Weather:** Get real-time weather information for any city, including temperature, wind speed, and humidity.
  * **Historical Data:** View a detailed chart of the daily temperature trends for the last year, allowing you to compare current conditions with historical data.
  * **User-Friendly Interface:** A clean and intuitive design for easy navigation and a seamless user experience.
  * **Lightweight & Fast:** Built with vanilla JavaScript, the application is fast and responsive without any heavy frameworks.

### Technologies Used

  * **HTML:** For the basic structure of the application.
  * **CSS:** For styling and a clean visual presentation.
  * **JavaScript:** To handle API calls, process data, and dynamically update the content.
  * **Open-Meteo API:** The core data source for all weather-related information.

### Getting Started

To get a local copy of the project up and running, follow these simple steps.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/ombhortake/Weather-webapp-XD.git
    ```

2.  **Navigate to the project directory:**

    ```bash
    cd Weather-webapp-XD
    ```

3.  **Open the application:**
    Simply open the `index.html` file in your preferred web browser. There's no server required, as it's a static site.

### How to Use

  * On the main page, type the name of a city into the search bar and press Enter or click the search button to get the current weather.
  * Navigate to the "History" or "Trends" section to see the historical temperature data for the last year, presented in a clear chart.

### API Reference

This project uses the [Open-Meteo API](https://open-meteo.com/), a free and open-source weather API. No API key is required, making it easy to use for personal and educational projects.

### Project Structure

```
Weather-webapp-XD/
├── css/
│   └── style.css          # Main styling for the app
├── js/
│   ├── app.js             # Core logic for fetching and displaying current weather
│   └── history.js         # Logic for fetching and displaying historical data
├── index.html             # The main landing page
├── history.html           # The page for historical data
└── README.md              # This file
```

### License
