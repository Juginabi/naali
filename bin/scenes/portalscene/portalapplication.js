// Joggingapplication invokes the jogger script when user connects to the world.
// This needs to be run with jogger.js

if (server.IsRunning())
{
    server.UserConnected.connect(ServerHandleUserConnected);
    server.UserDisconnected.connect(ServerHandleUserDisconnected);
    
    // If there are connected users when this script was added, add av for all of them
    var users = server.AuthenticatedUsers();
    if (users.length > 0)
        print("[Portal Application] Application started. Initializing portals for logged in clients.");

    for(var i=0; i < users.length; i++)
        ServerHandleUserConnected(users[i].id, users[i]);
}

function OnScriptDestroyed()
{
    print("[Portal Application] Script destroyed.");
}

function ServerHandleUserConnected(connectionID, user) 
{
    var entityIDs = scene.Entities();
    var re = new RegExp("^camdisplaywall");
    var found = 0;
    var entity = 0;
    
    // Loop through entity names and pick camdisplaywall named entities from it.
    for (i in entityIDs)
    {
        entity = scene.EntityById(i);
        found = entity.name.match(re)
        if (found) // found is null if no camdisplaywall string found.
        {
            var script = entity.GetOrCreateComponent("EC_Script");
            script.className = "PortalApp.Portal";
        }
    }

    // Start PortalManager script which observes mouse/gestures within client
    var myScript = me.GetOrCreateComponent("EC_Script");
    myScript.className = "PortalApp.PortalManager";

    if (user != null)
        print("[Portal Application] Portals initialized!");
}

function ServerHandleUserDisconnected(connectionID, user) 
{
    if (user != null) 
    {
        print("[Portal Application] User disconnected, destroyed portal entity.");
    }
}

function MouseLeftPress()
{
    print("Mouse left pressed " + this.me.name);
}

function MouseRightPress()
{
    print("Mouse right pressed " + this.me.name);
}
