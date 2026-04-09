# Neon Hub Configuration Interface

The Neon Hub Configuration Interface provides a centralized dashboard for managing your Neon Hub settings. The interface offers a user-friendly way to configure various aspects of your hub, with additional features planned for future updates.

## Current Features

### Authentication

- Basic authentication required to access the configuration interface
- Default credentials:
  - Username: `neon`
  - Password: `neon`
- Credentials can be modified using environment variables:
  - `NEON_HUB_CONFIG_USERNAME`
  - `NEON_HUB_CONFIG_PASSWORD`

### Configuration Tab

The Configuration tab provides access to four main sections:

#### 1. General Configuration

- **LOG_LEVEL**: Set Python logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- **Language**: Set system language using standard language codes
- **Time Format**: Choose between 12-hour and 24-hour time display
- **System Unit**: Select metric or imperial measurement system

#### 2. External API Keys

Manage API keys for various external services:

- [Alpha Vantage](https://www.alphavantage.co/)
- [OpenWeatherMap](https://home.openweathermap.org/)
- [Wolfram Alpha](https://products.wolframalpha.com/)

#### 3. HANA Configuration

Manage [HANA (HTTP API for Neon Applications)](https://github.com/NeonGeckoCom/neon-hana)-specific settings:

- FastAPI title and summary
- Service configurations
- System preferences

#### 4. IRIS Configuration

Configure [IRIS (Interactive Relay for Intelligence Systems)](https://github.com/NeonGeckoCom/neon-iris) web interface settings:

- WebSocket URL
- Interface labels
- Chat input settings
- Language preferences

### Features

- **Dark/Light Mode**: Automatically detects system preference with manual toggle
- **Secure Input**: Password and API key fields are protected
- **Tooltips**: Helpful information available for configuration options
- **External Links**: Quick access to relevant documentation
- **Auto-refresh**: Configuration state is kept up-to-date
- **Section-based Saving**: Individual sections can be saved independently

## Future Updates

The following features are currently in development:

- **Node Services**: Manage and monitor Neon Node services
- **Connected Devices**: View and manage devices connected to your hub
- **System Updates**: Handle system and component updates - currently handled through Yacht

## Technical Details

### API Endpoints

- `/v1/neon_config`: GET and POST Neon configuration
- `/v1/diana_config`: GET and POST Diana configuration
- `/auth`: Authentication endpoint

### Configuration Storage

- Neon configuration uses the OVOS configuration system
- Diana configuration is stored in `diana.yaml`
- All configurations persist across system restarts

### Security Notes

- Basic authentication is implemented for initial security
- All sensitive fields (passwords, API keys) are masked in the interface
- Configuration changes require authentication
- CORS is enabled for API access

## Best Practices

1. Regularly back up your configuration
2. Use strong passwords for authentication
3. Keep API keys secure and rotate them periodically
4. Test configuration changes in non-production environments first
5. Monitor LOG_LEVEL settings in production environments

## Running the Docker Container

To run the Neon Hub Configuration Interface as a Docker container, use the following command:

```bash
docker run -d -p 80:80 ghcr.io/neongeckocom/neon-hub-config:latest
```

For usage in a Neon Hub system, you will want to mount the configuration directory as a volume:

```bash
docker run -d -p 80:80 -v ~/.config/neon:/home/neon/.config/neon ghcr.io/neongeckocom/neon-hub-config:latest
```

> **Note:** The command above assumes the default XDG config location (`~/.config/neon`). If you deployed with the Neon Hub installer, it places config under `~/xdg/config/neon` instead — adjust the host side of the volume mount accordingly:
>
> ```bash
> docker run -d -p 80:80 -v ~/xdg/config/neon:/home/neon/.config/neon ghcr.io/neongeckocom/neon-hub-config:latest
> ```

## Support

For additional documentation and support:

- Python logging levels: [Python Logging Documentation](https://docs.python.org/3/library/logging.html#logging-levels)
- Language codes: [Langcodes Documentation](https://langcodes-hickford.readthedocs.io/en/sphinx/index.html#standards-implemented)
- API key services:
  - [Alpha Vantage API](https://www.alphavantage.co/support/#api-key)
  - [OpenWeatherMap API](https://home.openweathermap.org/appid)
  - [Wolfram Alpha API](https://products.wolframalpha.com/api/)

## Developing the UI

The UI is built using React and Material-UI. The project is bootstrapped with Vite. To build the UI, run the following commands in the `frontend/neon-hub-config` folder:

```bash
pnpm install
pnpm dev
```

## Building the UI

The UI is found in the `frontend/neon-hub-config` folder and is built using React and Material-UI. The project is bootstrapped with Vite. To build the UI, run the following commands in the `frontend/neon-hub-config` folder:

```bash
pnpm install
pnpm build
```

To package the UI into the backend, run the following command in the `frontend/neon-hub-config` folder:

```bash
pnpm build:py
```

## Running the UI

To run the UI, run the following command in the root of the repository:

```bash
poetry run python neon_hub_config/main.py
```

The UI will be available at `http://localhost`.
