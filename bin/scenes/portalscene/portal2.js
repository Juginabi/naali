// Portal Manager script which handles portal scene input actions from mouse/touch/actions

function PortalManager(entity, comp)
{
    //to track display entity visibility to disable rtt tex update
    this.rttBack = null;
    this.conName = "";
    this.freelookcameraPlaceable = null;
    this.objectGrabbed = false;
    this.touchPoints = [];
    this.portals = [];

    // Touch related
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.currentEntity = null;
    this.originalTransform = null;

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
    // Entity action handlers
    me.Action("objectGrabbed").Triggered.connect(this, this.setObjectGrabStatus);
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

PortalManager.prototype.OnTouchBegin = function(event)
{
	print("[Portal Manager] OnTouchBegin");

	this.touchPoints = event.touchPoints();

    for (var i = 0; i < this.touchPoints.length; ++i)
    {
        this.lastTouchX = this.touchPoints[i].pos().x();
        this.lastTouchY = this.touchPoints[i].pos().y();
        this.currentEntity = this.GetTargetedEntity(this.lastTouchX, this.lastTouchY);   
        this.currentEntity.rigidbody.mass = 0;
        this.originalTransform = this.currentEntity.placeable.transform;    
    }
}

PortalManager.prototype.GetTargetedEntity = function(x,y)
{
    var raycastResult = scene.ogre.Raycast(this.lastTouchX, this.lastTouchY);
    if (raycastResult.entity != null)
    {
        var id = raycastResult.entity.id;
        // Allow only certain entities to be chosen from portal scene.
        if (id > 11 && id < 19)
        {
            return raycastResult.entity;
        }
        else
            return null;
    }
    return null;
}

PortalManager.prototype.OnTouchUpdate = function(event)
{
	//print("[Portal Manager] OnTouchUpdate");

	this.touchPoints = event.touchPoints();

    for (var i = 0; i < this.touchPoints.length; ++i)
    {
        this.lastTouchX = this.touchPoints[i].pos().x();
        this.lastTouchY = this.touchPoints[i].pos().y();
    }
    var result = scene.ogre.Raycast(this.lastTouchX, this.lastTouchY);
    if (result.entity != null)
    {
        if (result.entity.id > 1 && result.entity.id < 6)
        {
            if (this.currentEntity != null)
            {
                this.currentEntity.placeable.SetPosition(result.entity.placeable.transform.pos);
            }
        }

    }
}

PortalManager.prototype.OnTouchEnd = function(event)
{
    for (var i = 0; i < this.touchPoints.length; ++i)
    {
        this.lastTouchX = this.touchPoints[i].pos().x();
        this.lastTouchY = this.touchPoints[i].pos().y();
    }
    var result = scene.ogre.Raycast(this.lastTouchX, this.lastTouchY);
    if (result.entity != null)
    {
        if (result.entity.id > 1 && result.entity.id < 6)
        {
            if (this.currentEntity != null && this.currentEntity.id == result.entity.id)
            {
                this.currentEntity.Exec(1, "MouseLeftPress", event);
            }
        }
    }
    
    if (this.currentEntity != null)
    {
        print("Releasing entity: " + this.currentEntity.name);
        this.currentEntity.rigidbody.mass = 10;
        var transform = this.currentEntity.placeable.transform;
        transform = this.originalTransform;
        this.currentEntity.placeable.transform = transform;
    }
    this.currentEntity = null;
}

PortalManager.prototype.setObjectGrabStatus = function(state)
{
	print("[Portal Manager] Set object grab status: " + state);
    this.objectGrabbed = state;
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
	    // Entity actions
	    me.Action("objectGrabbed").Triggered.disconnect(this, this.setObjectGrabStatus);
	}
}