#!/bin/bash
bashtrapExit()
{
    ps x | grep '\.\/Tundra --server' | awk '{print $1}' | xargs kill
}
bashtrapKillTerm()
{
    exitCode="$?"
    #This trap is used to clean up possible temp files, etc. if script recieves TERM KILL signal.
    echo 'Program sent exit code: ' $exitCode
    echo 'Killing servers now...'
    ps x | grep '\.\/Tundra --server' | awk '{print $1}' | xargs kill
    exit $?
}
    trap bashtrapKillTerm INT TERM KILL
    trap bashtrapExit EXIT
    cd scenes/

# Check if portal demoscenario assets are already downloaded
if test -f portalscene/assetsOK; then
    echo "PortalScene assets seems to be in order.."
else
    if test -f PortalScenario-assets.zip; then
        unzip PortalScenario-assets.zip
    else
        wget https://dl.dropboxusercontent.com/u/5680466/PortalScenario-assets/PortalScenario-assets.zip
        unzip PortalScenario-assets.zip
    fi
    # Everything ok now. Set flag for next run that assets are OK.
    touch portalscene/assetsOK
fi

    cd ..
    # Start servers.
    gnome-terminal -x ./Tundra --server --file scenes/portalscene/portalScene.txml --port 2345 --headless &
    sleep 1
    gnome-terminal -x ./Tundra --server --file scenes/clubhouse_t2/clubhouse.txml --port 2346 --headless &
    sleep 1
    gnome-terminal -x ./Tundra --server --file scenes/office2_t2/office2.txml --port 2347 --headless &
    sleep 1
    gnome-terminal -x ./Tundra --server --file scenes/Outdoor/outdoorspace.txml --port 2348 --headless &
    sleep 1
    gnome-terminal -x ./Tundra --server --file scenes/Oulu3D/scene-rigid-floor.txml --port 2349 --headless &
    sleep 1
    # Start viewer and connect to portal scene.
    ./Tundra --client --storage scenes/ --connect "127.0.0.1;2345;;;" --config viewer-portals.xml --nocentralwidget --fullscreen
    
    echo 'End of portal demo!'
    echo ''
