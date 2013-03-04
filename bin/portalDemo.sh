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
    cd /home/jukka/src/rex-juginabi/bin
    
    # Start servers.
    gnome-terminal -x ./Tundra --server --file scenes/portalscene/portalScene.txml --port 2345 --headless &
    gnome-terminal -x ./Tundra --server --file scenes/clubhouse_t2/clubhouse.txml --port 2346 --headless &
    gnome-terminal -x ./Tundra --server --file scenes/office2_t2/office2.txml --port 2347 --headless &
    gnome-terminal -x ./Tundra --server --file scenes/Outdoor/outdoorspace.txml --port 2348 --headless &
    gnome-terminal -x ./Tundra --server --file scenes/Oulu3D-Low/scene.txml --port 2349 --headless &
    
    # Start viewer with valgrind tool memcheck.
    ./Tundra --client --storage scenes/ --connect "127.0.0.1;2345;;;" --config viewer-portals.xml --nocentralwidget --fullscreen
    
    echo 'Full valgrind logs are stored in '$PWD'/valgrind/logs/'
    echo 'End of valgrind testdrive.'
    echo ''