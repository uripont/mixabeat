Test on: http://20.26.232.219

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


## Current frontend TODOs
  
For Music Room interface:
- [x] Create distribuion of containers keeping space for future improvements
- [x] Creae all required buttons and selectors
- [x] Create callbacks with logs to enable functionalities
- [x] Create Canvas for timeline
- [x] Divide the canvas into tracks
- [x] Assign one track to the actual user
- [x] Block tracks that are not available for the user to work on
- [ ] Add sounds to tracks

## Final Delivery TODOs
Here are some TODOs that we have already identified and that we want to work on for the final delivery. They are not yet definitive and many more need to be added but they already serve as a guide to know where we are.

- [ ] Create last screen of Review and download music

For Music Room screen:
- [ ] add sound to instrument selector
- [ ] add sounds to tracks
- [ ] set timer
      
For Review Room interface:
- [ ] Create room
- [ ] Set list of created songs
- [ ] Able review and download option for each song

For Chat Room (to be done for the final delivery)
- [ ] change avatar icons and selector
- [ ] improve some esthetic aspects
- [ ] send message when clicking`enter`
