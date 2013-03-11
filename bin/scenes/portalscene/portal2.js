// Portal Manager script which handles portal scene input actions from mouse/touch/actions

function PortalManager(entity, comp)
{
    //to track display entity visibility to disable rtt tex update
    this.rttBack = null;
    this.conName = "";
    this.freelookcameraPlaceable = null;
    this.touchPoints = [];
    this.portals = [];

    this.isServer = server.IsRunning();
    this.me = entity;

    if (this.isServer)
    {
        this.ServerInit();
    }
    else
    {
        this.ClientInit();
    }
}

PortalManager.prototype.ServerInit = function()
{
    print("[Portal Manager] Server initialize " + this.me.name);
}

PortalManager.prototype.ServerUpdate = function(frametime)
{

}

PortalManager.prototype.ClientInit = function()
{
    print("[Portal Manager] Client initialize.");
    
    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");

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
            this.portals.push(entity.id);
        }
    }

    // Mouse input handlers
    input.TopLevelInputContext().MouseLeftPressed.connect(this, this.MouseLeftPress);
    input.TopLevelInputContext().MouseRightPressed.connect(this, this.MouseRightPress);
  	// Touch input handlers
    input.TouchBegin.connect(this, this.OnTouchBegin);
    input.TouchUpdate.connect(this, this.OnTouchUpdate);
    input.TouchEnd.connect(this, this.OnTouchEnd);
}

PortalManager.prototype.MouseLeftPress = function(event)
{
	print("[Portal Manager] MouseLeftPress");

	// Get entity from mouseclick location.
    var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
    if(raycastResult.entity != null)
    {
        for (var i = 0; i < this.portals.length; ++i )
        {
        	if (raycastResult.entity.id == this.portals[i])
        	{
        		var entity = scene.EntityById(this.portals[i]);
        		entity.Exec(1, "MouseLeftPress", event);
        	}
        }
    }
}

PortalManager.prototype.MouseRightPress = function(event)
{
	print("[Portal Manager] MouseRightPress");	

    // Get entity from mouseclick location.
    var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
    if(raycastResult.entity != null)
    {
        for (var i = 0; i < this.portals.length; ++i )
        {
        	if (raycastResult.entity.id == this.portals[i])
        	{
        		var entity = scene.EntityById(this.portals[i]);
        		entity.Exec(1, "MouseRightPress", event);
        	}
        }
    }
}

PortalManager.prototype.OnScriptObjectDestroyed = function()
{
    print("[Portal Manager] Script destroyed.");

    if (!this.isServer)
    {
	    // Mouse input handlers
	    input.TopLevelInputContext().MouseLeftPressed.disconnect(this, this.MouseLeftPress);
	    input.TopLevelInputContext().MouseRightPressed.disconnect(this, this.MouseRightPress);
	  	// Touch input handlers
	    input.TouchBegin.disconnect(this, this.OnTouchBegin);
	    input.TouchUpdate.disconnect(this, this.OnTouchUpdate);
	    input.TouchEnd.disconnect(this, this.OnTouchEnd);
	}
}