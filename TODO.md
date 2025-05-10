# TODO

- Add a way to input `ends_at` on `/incident create` field for maintenance
- think about removing subscription stuff as this seems very specific to my setup
- General note on "run these two scripts regularly via cron so that ... happens"
  - AI added: this is a bit of a cop-out. It would be better to have a systemd service that runs these scripts on a schedule. This is more robust and more in line with modern Linux practices.
- General note give an example of how to run the scripts and what they can do if they run into "bad option" node-errors
  - Solution 1: add `PATH=/home/helper/.nvm/versions/node/v22.11.0/bin:$PATH` to shell script
