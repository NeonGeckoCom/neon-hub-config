"""
Neon Hub Configuration Server

This module provides a FastAPI-based web server for managing Neon Hub and Diana configurations.
It includes basic authentication and configuration management capabilities.

Environment Variables:
    NEON_HUB_CONFIG_USERNAME: Username for basic auth (default: "neon")
    NEON_HUB_CONFIG_PASSWORD: Password for basic auth (default: "neon")
    DIANA_PATH: Path to the Diana configuration file (default: "/xdg/config/neon/diana.yaml")
    NEON_PATH: Path to the Neon configuration file (default: "/xdg/config/mycroft/mycroft.conf")
"""
import base64
import logging
import secrets
import string
from functools import wraps
from os import getenv
from os.path import exists, join, realpath, split, expanduser
from typing import Dict, Optional

import requests as http_requests
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic
from fastapi.staticfiles import StaticFiles
from ovos_config import Configuration
from ovos_config.config import update_mycroft_config
from ovos_utils.log import LOG
from ruamel.yaml import YAML

logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.DEBUG)

VALID_USERNAME = getenv("NEON_HUB_CONFIG_USERNAME", "neon")
VALID_PASSWORD = getenv("NEON_HUB_CONFIG_PASSWORD", "neon")
DIANA_PATH = expanduser(getenv("DIANA_PATH", "/xdg/config/neon/diana.yaml"))
NEON_PATH = expanduser(getenv("NEON_PATH", "/xdg/config/neon/neon.yaml"))
HANA_SERVICE_HOST = getenv("HANA_SERVICE_HOST", "neon-hana")
HUB_ADMIN_TOKEN_FILE = expanduser(
    getenv("HUB_ADMIN_TOKEN_FILE", "/xdg/config/neon/hub_admin.yaml"))

security = HTTPBasic()


class HanaClient:
    """Manages an authenticated session with HANA using the Hub admin token."""

    def __init__(self, token_file: str, hana_url: str):
        self._token_file = token_file
        self._hana_url = hana_url
        self._access_token = None
        self._refresh_token = None
        self._username = None
        self._password = None
        self._load_token()

    def _load_token(self):
        try:
            with open(self._token_file, "r", encoding="utf-8") as f:
                data = YAML().load(f) or {}
            self._refresh_token = data.get("refresh_token")
            self._username = data.get("username")
            self._password = data.get("password")
            if self._refresh_token:
                self._refresh_access_token()
        except FileNotFoundError:
            logger.warning("Hub admin token file not found at %s",
                           self._token_file)
        except Exception as e:
            logger.warning("Failed to load hub admin token: %s", e)

    def _refresh_access_token(self):
        if not self._username or not self._password:
            logger.warning("Cannot refresh HANA token: missing credentials")
            return
        try:
            resp = http_requests.post(
                f"{self._hana_url}/auth/login",
                json={
                    "username": self._username,
                    "password": self._password,
                    "token_name": "hub-config",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._access_token = data.get("access_token")
                self._refresh_token = data.get("refresh_token",
                                                self._refresh_token)
                self._save_token()
            else:
                logger.warning("HANA login failed: %s", resp.text)
        except http_requests.RequestException as e:
            logger.warning("Failed to reach HANA for token refresh: %s", e)

    def _save_token(self):
        # Preserve the admin password the installer wrote alongside the
        # refresh token. Without it, a restart after the first save
        # has no fallback when the cached refresh token becomes
        # unusable (network blip during refresh, refresh-token TTL
        # expiry on a long-idle hub, etc.) — _refresh_access_token
        # logs "missing credentials" and the QR pairing endpoint
        # serves 503 forever. Future work: use HANA's /auth/refresh
        # for the hot path and keep the password as a cold-recovery
        # fallback only.
        try:
            payload = {
                "username": self._username,
                "refresh_token": self._refresh_token,
            }
            if self._password:
                payload["password"] = self._password
            with open(self._token_file, "w", encoding="utf-8") as f:
                YAML().dump(payload, f)
        except Exception as e:
            logger.warning("Failed to save updated token: %s", e)

    def post(self, path: str, **kwargs) -> http_requests.Response:
        """Make an authenticated POST to HANA. Retries once on 401/403."""
        resp = self._do_post(path, **kwargs)
        if resp.status_code in (401, 403):
            self._refresh_access_token()
            resp = self._do_post(path, **kwargs)
        return resp

    def _do_post(self, path: str, **kwargs) -> http_requests.Response:
        headers = kwargs.pop("headers", {})
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        return http_requests.post(
            f"{self._hana_url}{path}",
            headers=headers,
            timeout=kwargs.pop("timeout", 10),
            **kwargs,
        )

    @property
    def is_available(self) -> bool:
        return self._access_token is not None

    @property
    def username(self) -> Optional[str]:
        return self._username

    @property
    def password(self) -> Optional[str]:
        return self._password


class NeonHubConfigManager:
    """
    Singleton class to manage Neon Hub and Diana configurations.

    This class handles loading, saving, and managing configurations for both
    Neon Hub and Diana components. It maintains separate configuration files
    and provides methods for updating and retrieving configurations.

    Attributes:
        logger: Logger instance for tracking operations
        yaml: YAML handler configured for preserving quotes and specific indentation
        default_diana_config: Default configuration for Diana
        neon_config: Instance of Configuration for Neon Hub
        diana_config_path: Full path to the Diana configuration file
        diana_config: Current Diana configuration
        neon_config_path: Full path to the Neon user configuration file
    """

    def __init__(self):
        """Initialize the configuration manager with default settings."""
        # Initialize YAML handler
        self.logger = LOG()
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)

        # Default configuration
        self.default_diana_config = {}

        # Initialize Neon configuration
        self.neon_config = Configuration()
        self.neon_user_config_path = NEON_PATH or self.neon_config.xdg_configs[0].path
        self.neon_user_config = self._load_neon_user_config()

        # Initialize Diana config
        self.diana_config_path = DIANA_PATH
        self.logger.info(f"Loading Diana config in {self.diana_config_path}")
        self.diana_config = self._load_diana_config()

    def _load_diana_config(self) -> Dict:
        """Load Diana configuration from file, creating it with defaults if needed."""
        if not exists(self.diana_config_path):
            self._save_diana_config(self.default_diana_config)
            return self.default_diana_config.copy()

        try:
            with open(self.diana_config_path, "r", encoding="utf-8") as file:
                config = self.yaml.load(file)
                if config is None:  # File exists but is empty
                    config = self.default_diana_config.copy()
                    self._save_diana_config(config)
                self.diana_config = config
                return config
        except Exception as e:
            self.logger.exception(f"Error loading config: {e}")
            return self.default_diana_config.copy()

    def _load_neon_user_config(self) -> Optional[Dict]:
        """
        Load Neon user configuration from file, creating it with defaults if needed.

        Returns:
            Optional[Dict]: The loaded configuration or default configuration if loading fails
        """
        try:
            with open(self.neon_user_config_path, "r", encoding="utf-8") as file:
                config = self.yaml.load(file)
                return config
        except Exception as e:
            self.logger.exception(f"Error loading Neon user config: {e}")

    def _save_diana_config(self, config: Dict) -> None:
        """
        Save Diana configuration to file.

        Args:
            config (Dict): Configuration to save
        """
        try:
            with open(self.diana_config_path, "w+", encoding="utf-8") as file:
                previous_config = self.yaml.load(file) or {}
                new_config = {**previous_config, **config}
                self.yaml.dump(new_config, file)
        except Exception as e:
            self.logger.exception(f"Error saving config: {e}")

    def _save_neon_user_config(self, config: Dict) -> None:
        """
        Save Neon user configuration directly to file.

        Args:
            config (Dict): Configuration to save
        """
        try:
            with open(self.neon_user_config_path, "w+", encoding="utf-8") as file:
                previous_config = self.yaml.load(file) or {}
                new_config = {**previous_config, **config}
                self.yaml.dump(new_config, file)
        except Exception as e:
            self.logger.exception(f"Error saving Neon user config: {e}")

    def get_neon_config(self) -> Dict:
        """
        Get the current Neon Hub configuration.

        Returns:
            Dict: Current Neon Hub configuration
        """
        self.neon_config.reload()
        return self.neon_config

    def get_neon_user_config(self) -> Optional[Dict]:
        """
        Get the current Neon user configuration.

        Returns:
            Dict: Current Neon user configuration
        """
        return self._load_neon_user_config()

    def update_neon_config(self, config: Dict) -> Optional[Dict]:
        """
        Update the Neon Hub configuration.

        Args:
            config (Dict): New configuration to apply

        Returns:
            Dict: Updated configuration
        """
        self.logger.info("Updating Neon config")
        update_mycroft_config(config)
        self.neon_config.reload()
        return self.get_neon_user_config()

    def update_neon_user_config(self, config: Dict) -> Optional[Dict]:
        """
        Update the Neon Hub configuration.

        Args:
            config (Dict): New configuration to apply

        Returns:
            Dict: Updated configuration
        """
        self.logger.info("Updating Neon config")
        self._save_neon_user_config(config)
        return self.get_neon_user_config()

    def get_diana_config(self) -> Dict:
        """
        Get the current Diana configuration.

        Returns:
            Dict: Current Diana configuration
        """
        self._load_diana_config()
        return self.diana_config

    def update_diana_config(self, config: Dict) -> Dict:
        """
        Update the Diana configuration.

        Args:
            config (Dict): New configuration to apply

        Returns:
            Dict: Updated configuration
        """
        self.logger.info("Updating Diana config")
        self._save_diana_config(config)
        return self._load_diana_config()


def _generate_node_password(length: int = 24) -> str:
    """Generate a secure random password for node pairing."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _get_hana_url(manager: NeonHubConfigManager) -> str:
    """Get the HANA URL for server-to-server API calls.

    In a standard Hub deployment, hub-config and HANA are on the same
    Docker network, so we reach HANA at http://neon-hana:8080.
    If server_host is an actual hostname, construct the URL from it
    directly — this is the internal API address, not the Node-facing
    address (which may differ due to reverse proxies or port mapping).
    """
    diana = manager.get_diana_config()
    hana_cfg = diana.get("hana", {})
    host = hana_cfg.get("server_host", "0.0.0.0")
    port = hana_cfg.get("port", 8080)
    if host == "0.0.0.0":
        return f"http://{HANA_SERVICE_HOST}:{port}"
    scheme = "https" if port == 443 else "http"
    if (scheme == "https" and port == 443) or (scheme == "http" and port == 80):
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


def _get_hub_address(manager: NeonHubConfigManager) -> str:
    """Get the external Hub address that Nodes should connect to."""
    neon_cfg = manager.get_neon_user_config() or {}
    node_cfg = neon_cfg.get("neon_node", {})
    hana_address = node_cfg.get("hana_address")
    if hana_address:
        return hana_address
    import socket
    hostname = socket.gethostname()
    return f"http://{hostname}:8082"


app = FastAPI(
    title="Neon Hub Configuration API",
    description="API for managing Neon Hub and Diana configurations with basic authentication",
    version="1.0.0",
)
config_manager = NeonHubConfigManager()
hana_client = HanaClient(
    token_file=HUB_ADMIN_TOKEN_FILE,
    hana_url=_get_hana_url(config_manager),
)

# Configure CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def require_auth(func):
    """Decorator to require authentication for routes"""
    @wraps(func)
    async def wrapper(*args, username: str = Depends(verify_auth_header), **kwargs):
        return await func(*args, username=username, **kwargs)
    return wrapper


async def verify_auth_header(authorization: str = Header(None)):
    """
    Verify the Basic Authentication header.

    Args:
        authorization (str): Authorization header value

    Returns:
        str: Username if authentication is successful

    Raises:
        HTTPException: If authentication fails
    """
    if not authorization or not authorization.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    try:
        auth_decoded = base64.b64decode(authorization.split(" ")[1]).decode("utf-8")
        username, password = auth_decoded.split(":")

        if username != VALID_USERNAME or password != VALID_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        return username
    except Exception as e:
        logger.exception("Auth error: %s", e)
        raise HTTPException(status_code=401, detail="Invalid authentication credentials") from e


def get_config_manager():
    """
    Get the singleton instance of NeonHubConfigManager.

    Returns:
        NeonHubConfigManager: The singleton config manager instance
    """
    return config_manager


@app.post("/auth")
@require_auth
async def authenticate(username: str = Depends(verify_auth_header)):
    """
    Authenticate user credentials.

    Args:
        username (str): Username extracted from Basic Auth header

    Returns:
        dict: Authentication success message with username
    """
    return {"message": "Authentication successful", "username": username}


@app.get("/v1/neon_config")
async def neon_get_config(
    manager: NeonHubConfigManager = Depends(get_config_manager)
):
    """
    Get the current Neon Hub configuration.

    Returns:
        Dict: Current Neon Hub configuration
    """
    return manager.get_neon_config()


@app.post("/v1/neon_config")
async def neon_update_config(
    config: Dict,
    manager: NeonHubConfigManager = Depends(get_config_manager),
):
    """
    Update the Neon Hub configuration.

    Args:
        config (Dict): New configuration to apply

    Returns:
        Dict: Updated configuration
    """
    logger.info("Updating Neon config")
    return manager.update_neon_config(config)

@app.get("/v1/neon_user_config")
async def neon_get_user_config(
    manager: NeonHubConfigManager = Depends(get_config_manager)
):
    """
    Get the current Neon Hub configuration.

    Returns:
        Dict: Current Neon Hub configuration
    """
    config = manager.get_neon_user_config()
    if config is None:
        return {"error": "Failed to load Neon user config"}
    return config


@app.post("/v1/neon_user_config")
async def neon_update_user_config(
    config: Dict,
    manager: NeonHubConfigManager = Depends(get_config_manager),
):
    """
    Update the Neon Hub configuration.

    Args:
        config (Dict): New configuration to apply

    Returns:
        Dict: Updated configuration
    """
    logger.info("Updating Neon config")
    manager.update_neon_user_config(config)
    return manager.get_neon_user_config()


@app.get("/v1/diana_config")
async def diana_get_config(
    manager: NeonHubConfigManager = Depends(get_config_manager)
):
    """
    Get the current Diana configuration.

    Returns:
        Dict: Current Diana configuration
    """
    return manager.get_diana_config()


@app.post("/v1/diana_config")
async def diana_update_config(
    config: Dict,
    manager: NeonHubConfigManager = Depends(get_config_manager),
):
    """
    Update the Diana configuration.

    Args:
        config (Dict): New configuration to apply

    Returns:
        Dict: Updated configuration
    """
    logger.info("Updating Diana config")
    return manager.update_diana_config(config)


@app.post("/v1/pair")
@require_auth
async def create_node_pairing(
    username: str = Depends(verify_auth_header),
    manager: NeonHubConfigManager = Depends(get_config_manager),
):
    """
    Generate NODE-scoped tokens for pairing a Node to this Hub.

    Logs in as the Hub admin with node_auth=true to obtain tokens
    scoped to AccessRoles.NODE. The QR code encodes these tokens
    directly — no password leaves the Hub.
    """
    if not hana_client.is_available or not hana_client.password:
        raise HTTPException(
            status_code=503,
            detail="Hub admin credentials not configured. Run the "
                   "installer to set up the admin account.",
        )

    hub_address = _get_hub_address(manager)
    hana_url = _get_hana_url(manager)

    try:
        login_response = http_requests.post(
            f"{hana_url}/auth/login",
            json={
                "username": hana_client.username,
                "password": hana_client.password,
                "token_name": f"node-{secrets.token_hex(4)}",
                "node_auth": True,
            },
            timeout=10,
        )
        if login_response.status_code != 200:
            logger.error("HANA node login failed: %s %s",
                         login_response.status_code, login_response.text)
            raise HTTPException(status_code=502,
                                detail="Failed to generate node tokens")
    except http_requests.RequestException as e:
        logger.error("Failed to reach HANA: %s", e)
        raise HTTPException(status_code=502,
                            detail="Could not connect to HANA service")

    login_data = login_response.json()
    return {
        "hub_address": hub_address,
        "access_token": login_data["access_token"],
        "refresh_token": login_data["refresh_token"],
    }


project_dir, _ = split(realpath(__file__))
app.mount(
    "/",
    StaticFiles(directory=join(project_dir, "static"), html=True),
    name="Neon Hub Configuration",
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=80)
