# Configuring VM for Static File Hosting

To serve static files via Apache on the VM:

1. Configure file permissions (one-time setup):
```bash
# Grant ownership to your admin user and www-data group
sudo chown -R uripont-admin:www-data /var/www/html/
# Set proper directory permissions
sudo chmod -R 775 /var/www/html/
```

2. Transfer files:
    - Use SFTP client (like FileZilla)
    - Connect to VM using admin credentials
    - Upload files to `/var/www/html/`

3. Access files:
    - Browse to your VM's public IP
    - Files in `/var/www/html/` will be served automatically
    - Verify that the files are accessible via a web browser (e.g. `http://<VM_IP>/` to access `index.html`)

Note: Apache serves files from `/var/www/html/` by default.