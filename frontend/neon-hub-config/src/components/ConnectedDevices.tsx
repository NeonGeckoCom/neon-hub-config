import React from "react";

interface ConnectedDevicesProps {
    isDark: boolean;
}
const ConnectedDevices: React.FC<ConnectedDevicesProps> = ({isDark}) => {
  console.debug("ConnectedDevicesProps", isDark);
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Connected Devices</h2>
      <p className="text-gray-600 dark:text-gray-300">
        This feature is currently under development. It will display information about devices connected to the Hub.
      </p>
    </div>
  );
};

export default ConnectedDevices;
