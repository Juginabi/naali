if (!server.IsRunning() && !framework.IsHeadless())
{
    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");
}

function ObjectGrab(entity, comp)
{
    this.prevPosX = 0;
    this.prevPosY = 0;
    this.me = entity;
    this.selectedId = -1;
    this.entities = [];
    this.entityDist = 0;
    
    // Touch related
    this.startTouchX = 0;
    this.startTouchY = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchPoints = [];

    this.currentEntity = null;
    this.originalTransform = [];
    this.objectActive = false;
    this.animDirection = true;
    this.targetPortal = 0;
    this.trashcan = 0;
    this.ctrlDown = false;
    this.material = null;
    //this.timer = new QTimer();

    if(!server.IsRunning())
    {
        frame.Updated.connect(this, this.UpdateSelectionAnimation);
        this.CreateInput();
    }
}

ObjectGrab.prototype.CreateInput = function()
{
    // Use inputmapper with mouse for now, since
    // we don't have the fancy sensors working yet
    var inputmapper = this.me.GetOrCreateComponent("EC_InputMapper", 2, false);
    inputmapper.contextPriority = 100;
    inputmapper.takeMouseEventsOverQt = true;
    inputmapper.modifiersEnabled = false;
    inputmapper.executionType = 1; // Execute actions locally

    // Connect mouse gestures
    var inputContext = inputmapper.GetInputContext();
    //inputContext.GestureStarted.connect(this, this.GestureStarted);
    //inputContext.GestureUpdated.connect(this, this.GestureUpdated);
    inputContext.MouseMove.connect(this, this.HandleMouseMove);
    inputContext.MouseLeftPressed.connect(this, this.HandleMouseLeftPressed);
    inputContext.MouseLeftReleased.connect(this,this.HandleMouseLeftReleased)
    //inputContext.MouseRightPressed.connect(this, this.HandleMouseRightPressed);
    inputContext.KeyPressed.connect(this, this.HandleKeyPressed);
    inputContext.KeyReleased.connect(this, this.HandleKeyPressed);
}

ObjectGrab.prototype.OnTouchBegin = function(event)
{
    print("[ObjectGrab] OnTouchBegin");

    this.touchPoints = event.touchPoints();

    // restrict grabbing of objects to specific items in the scene
    var i = 0;
    var entityID = this.GetTargetedEntity(this.touchPoints[0].pos().x(), this.touchPoints[0].pos().y());
    if (entityID >= 12 && entityID <= 18)
    {
        // Check if user selects already selected entity. Deselect it if so.
        //var length = this.entities.length;
        for (var i = 0; i < this.entities.length; ++i)
        {
            if (this.entities[i] == entityID)
            {
                var entity = scene.EntityById(this.entities.splice(i,1));
                var position = this.originalTransform[i].pos;
                this.originalTransform.splice(i,1);
                var oldTf = entity.placeable.transform;
                oldTf.pos = position;
                entity.placeable.transform = oldTf;
                entity.RemoveComponent("EC_Highlight");
                this.HighlightActivity(false);
                return;
            }
        }
        // If CTRL not pressed, clear all the selections
        if (!this.ctrlDown)
        {
            var length = this.entities.length;
            for (var i = 0; i < length; ++i)
            {
                var ent = scene.EntityById(this.entities.pop());
                ent.placeable.transform = this.originalTransform.pop();
                ent.rigidbody.mass = 10;
                ent.highlight.visible = false;
            }
        }
        // Select chosen entity and activate highlight component on it.
        var ent = scene.EntityById(entityID);
        this.originalTransform.push(ent.placeable.transform);
        ent.rigidbody.mass = 0;
        ent.GetOrCreateComponent("EC_Highlight", 2, false);
        ent.highlight.visible = true;
        this.entities.push(entityID);
        this.HighlightActivity(true);
    }
}

ObjectGrab.prototype.OnTouchUpdate = function(event)
{
    print("[ObjectGrab] OnTouchUpdate");

    this.touchPoints = event.touchPoints();

    var cam = scene.EntityByName("FreeLookCamera").camera;
    if (cam)
    {
        var mainWindow = ui.MainWindow();
        var windowWidth = mainWindow.width;
        var windowHeight = mainWindow.height;

        var ray = cam.GetMouseRay(this.touchPoints[0].pos().x()/windowWidth, this.touchPoints[0].pos().y()/windowHeight);
        if (ray)
        {
            for (var i = 0; i < this.entities.length; ++i)
            {
                var entity = scene.EntityById(this.entities[i]);
                var tf = entity.placeable.transform;
                // Check what is behind the entity.
                entity.placeable.selectionLayer = 0xf0000000;
                var raycastResult = scene.ogre.Raycast(event.x, event.y, 0x0fffffff);
                var re1 = new RegExp("^camdisplaywall");
                var re2 = new RegExp("^Trash");
                if (raycastResult.entity.name.match(re1))
                {
                    // Set pointed portal as target portal.
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);

                    this.targetPortal = raycastResult.entity;
                    this.targetPortal.Exec(1, "objectGrabbed", 1);
                    
                    tf.pos = raycastResult.entity.placeable.transform.pos;
                    entity.placeable.transform = tf;
                }
                else if (raycastResult.entity.name.match(re2))
                {
                    // trashcan
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);
                    this.targetPortal = 0;
                    this.trashcan = raycastResult.entity;
                    tf.pos = raycastResult.entity.placeable.transform.pos;
                    entity.placeable.transform = tf;
                }
                else
                {
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);
                    this.targetPortal = 0;
                    this.trashcan = 0;
                    // Distance from viewport
                    var distance = tf.pos.Distance(ray.pos);
                    var uusPaikka = ray.dir.Mul(11);
                    // Set object position to mouse cursor
                    var positio = uusPaikka.Add(ray.pos);
                    if (positio.y < 0.6)
                        positio.y = 0.6
                    tf.pos = positio;
                    entity.placeable.transform = tf;
                } 
            }
            if (this.entities.length == 0)
            {
                if (this.targetPortal)
                    this.targetPortal.Exec(1, "objectGrabbed", 0);
                this.targetPortal = 0;
            }
        }
    }
}

ObjectGrab.prototype.OnTouchEnd = function(event)
{
    print("[ObjectGrab] OnTouchEnd");

    // If objects are grabbed and on top of the portal transfer them there.
    if (this.targetPortal)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            entity.rigidbody.mass = 10;
            entity.highlight.visible = false;
            this.HighlightActivity(false);
            this.targetPortal.Exec(1, "Collision",entity.id, scene.name, transform.scale.x);
        }
    }
    else if (this.trashcan)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            entity.rigidbody.mass = 10;
            entity.highlight.visible = false;
            this.HighlightActivity(false);
            scene.RemoveEntity(entity.id, 2);
            this.trashcan = 0;
        }
    }
    // Just deselect all entities and return them to original positions.
    var length = this.entities.length;
    for (var i = 0; i < length; ++i)
    {
        var ent = scene.EntityById(this.entities.pop());
        ent.placeable.transform = this.originalTransform.pop();
        ent.rigidbody.mass = 10;
        ent.highlight.visible = false;
        this.HighlightActivity(false);
    }

    // var directionDown = false;
    // for (var i = 0; i < this.touchPoints.length; ++i)
    // {
    //     if (this.startTouchY < this.touchPoints[i].pos().y())
    //         directionDown = true;
    //     this.lastTouchX = this.touchPoints[i].pos().x();
    //     this.lastTouchY = this.touchPoints[i].pos().y();
    // }
    // var result = scene.ogre.Raycast(this.lastTouchX, this.lastTouchY);
    // if (result.entity != null)
    // {
    //     if (result.entity.id > 1 && result.entity.id < 6)
    //     {
    //         if (this.currentEntity != null && this.currentEntity.id == result.entity.id)
    //         {
    //             directionDown ? this.currentEntity.Exec(1, "MouseRightPress", event) : this.currentEntity.Exec(1, "MouseLeftPress", event);       
    //         }
    //     }
    // }
    
    // if (this.currentEntity != null && this.currentEntity.id > 11 && this.currentEntity.id < 19)
    // {
    //     print("Releasing entity: " + this.currentEntity.name);
    //     this.currentEntity.rigidbody.mass = 10;
    //     var transform = this.currentEntity.placeable.transform;
    //     transform = this.originalTransform;
    //     this.currentEntity.placeable.transform = transform;
    // }
    // this.currentEntity = null;
}

// Get entity id as projected through viewport
// params: screen co-ordinates
// return: entity id if found, -1 for not found
ObjectGrab.prototype.GetTargetedEntity = function(x, y)
{
    var raycastResult = scene.ogre.Raycast(x, y, 0xffffffff);
    if(raycastResult.entity != null) {
        if (raycastResult.entity.id >= 12 && raycastResult.entity.id <= 18)
            return raycastResult.entity.id;
        else
            return -1;
    }
    return -1;
}

// Set entity as selected
ObjectGrab.prototype.SelectEntity = function(entityId)
{
    var entity = scene.GetEntity(entityId);

    // Shouldn't be null, but let's stay on the safe side
    if(entity.mesh == null || entity.placeable == null)
        return;

    // Selection changed
    if(this.selectedId != entityId)
    {
        // Release previous selection in case it was left selected
        this.ReleaseSelection();

        // Save the original orientation of the entity
        //this.originalOrientation = entity.placeable.WorldOrientation();
        //this.originalPosition = entity.placeable.transform.pos;
        this.originalTransform = entity.placeable.transform;
        entity.rigidbody.mass = 0;
        entity.rigidbody.phantom = true;
        this.selectedId = entityId;
    }
}

ObjectGrab.prototype.HandleKeyPressed = function(e)
{
    this.ctrlDown = e.HasCtrlModifier();
}

// Release selection on entity
ObjectGrab.prototype.ReleaseSelection = function()
{
    // Reset the orientation of the old selection
    if(this.selectedId != -1)
    {
        var entity = scene.GetEntity(this.selectedId);
        //var transform = entity.placeable.transform;

        //transform.pos = this.originalPosition;
        //entity.placeable.SetOrientation(this.originalOrientation);
        entity.placeable.transform = this.originalTransform;
        entity.rigidbody.mass = 10;
        entity.rigidbody.phantom = false;
        this.selectedId = -1;
    }
}

// If there's a selected object, update the animation indicating
// it's selected
ObjectGrab.prototype.UpdateSelectionAnimation = function()
{
    var entity = scene.GetEntity(this.entities[0]);
    if(entity == null)
        return;

    var degs = 5;

    var transform = entity.placeable.transform;
    transform.rot.y += degs;
    entity.placeable.transform = transform;
}

// <MOUSE HANDLERS>
ObjectGrab.prototype.HandleMouseMove = function(event)
{
    var cam = scene.EntityByName("FreeLookCamera").camera;
    if (cam)
    {
        var mainWindow = ui.MainWindow();
        var windowWidth = mainWindow.width;
        var windowHeight = mainWindow.height;

        var ray = cam.GetMouseRay(event.x/windowWidth, event.y/windowHeight);
        if (ray)
        {
            for (var i = 0; i < this.entities.length; ++i)
            {
                var entity = scene.EntityById(this.entities[i]);
                var tf = entity.placeable.transform;
                // Check what is behind the entity.
                entity.placeable.selectionLayer = 0xf0000000;
                var raycastResult = scene.ogre.Raycast(event.x, event.y, 0x0fffffff);
                var re1 = new RegExp("^camdisplaywall");
                var re2 = new RegExp("^Trash");
                if (raycastResult.entity.name.match(re1))
                {
                    // Set pointed portal as target portal.
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);

                    this.targetPortal = raycastResult.entity;
                    this.targetPortal.Exec(1, "objectGrabbed", 1);
                    
                    tf.pos = raycastResult.entity.placeable.transform.pos;
                    entity.placeable.transform = tf;
                }
                else if (raycastResult.entity.name.match(re2))
                {
                    // trashcan
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);
                    this.targetPortal = 0;
                    this.trashcan = raycastResult.entity;
                    tf.pos = raycastResult.entity.placeable.transform.pos;
                    entity.placeable.transform = tf;
                }
                else
                {
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);
                    this.targetPortal = 0;
                    this.trashcan = 0;
                    // Distance from viewport
                    var distance = tf.pos.Distance(ray.pos);
                    var uusPaikka = ray.dir.Mul(11);
                    // Set object position to mouse cursor
                    var positio = uusPaikka.Add(ray.pos);
                    if (positio.y < 0.6)
                        positio.y = 0.6
                    tf.pos = positio;
                    entity.placeable.transform = tf;
                } 
            }
            if (this.entities.length == 0)
            {
                if (this.targetPortal)
                    this.targetPortal.Exec(1, "objectGrabbed", 0);
                this.targetPortal = 0;
            }
        }
    }
    this.prevPosX = event.x;
    this.prevPosY = event.y;
}

ObjectGrab.prototype.HandleMouseRightPressed = function(event)
{
    // If objects are grabbed and on top of the portal transfer them there.
    if (this.targetPortal)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            entity.rigidbody.mass = 10;
            entity.highlight.visible = false;
            this.targetPortal.Exec(1, "Collision",entity.id, scene.name, transform.scale.x);
            scene.RemoveEntity(entity.id, 2);
        }
        return;
    }
    else if (this.trashcan)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            entity.rigidbody.mass = 10;
            entity.highlight.visible = false;
            this.targetPortal.Exec(1, "Collision",entity.id, scene.name, transform.scale.x);
            //scene.RemoveEntity(entity.id, 2);
            this.trashcan = 0;
        }
        return;
    }
    // restrict grabbing of objects to three dices in the scene.
    var i = 0;
    var entityID = this.GetTargetedEntity(event.x, event.y);
    if (entityID >= 12 && entityID <= 18)
    {
        // If CTRL not pressed, clear all the selections
        if (!this.ctrlDown)
        {
            var length = this.entities.length;
            for (var i = 0; i < length; ++i)
            {
                var ent = scene.EntityById(this.entities.pop());
                ent.placeable.transform = this.originalTransform.pop();
                ent.rigidbody.mass = 10;
                ent.highlight.visible = false;
            }
        }

        // Check if user selects already selected entity. Deselect it if so.
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            if (this.entities[i] == entityID)
            {
                var entity = scene.EntityById(this.entities.splice(i,1));
                this.originalTransform.splice(i,1);
                entity.highlight.visible = false;
                return;
            }
        }
        // Select chosen entity and activate highlight component on it.
        var ent = scene.EntityById(entityID);
        this.originalTransform.push(ent.placeable.transform);
        ent.rigidbody.mass = 0;
        ent.GetOrCreateComponent("EC_Highlight", 2, false);
        ent.highlight.visible = true;
        this.entities.push(entityID);
    }
    else
    {
        // Just deselect all entities and return them to original positions.
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var ent = scene.EntityById(this.entities.pop());
            ent.placeable.transform = this.originalTransform.pop();
            ent.rigidbody.mass = 10;
            ent.highlight.visible = false;
        }
    }
}

ObjectGrab.prototype.HandleMouseLeftPressed = function(event)
{
    // restrict grabbing of objects to specific items in the scene
    var i = 0;
    var entityID = this.GetTargetedEntity(event.x, event.y);
    if (entityID >= 12 && entityID <= 18)
    {
        // Check if user selects already selected entity. Deselect it if so.
        //var length = this.entities.length;
        for (var i = 0; i < this.entities.length; ++i)
        {
            if (this.entities[i] == entityID)
            {
                var entity = scene.EntityById(this.entities.splice(i,1));
                var position = this.originalTransform[i].pos;
                this.originalTransform.splice(i,1);
                var oldTf = entity.placeable.transform;
                oldTf.pos = position;
                entity.placeable.transform = oldTf;
                entity.RemoveComponent("EC_Highlight");
                this.HighlightActivity(false);
                return;
            }
        }
        // If CTRL not pressed, clear all the selections
        if (!this.ctrlDown)
        {
            var length = this.entities.length;
            for (var i = 0; i < length; ++i)
            {
                var ent = scene.EntityById(this.entities.pop());
                ent.placeable.transform = this.originalTransform.pop();
                ent.rigidbody.mass = 10;
                ent.highlight.visible = false;
            }
        }
        // Select chosen entity and activate highlight component on it.
        var ent = scene.EntityById(entityID);
        this.originalTransform.push(ent.placeable.transform);
        ent.rigidbody.mass = 0;
        ent.GetOrCreateComponent("EC_Highlight", 2, false);
        ent.highlight.visible = true;
        this.entities.push(entityID);
        this.HighlightActivity(true);
    }
}

ObjectGrab.prototype.HandleMouseLeftReleased = function(event)
{
    // If objects are grabbed and on top of the portal transfer them there.
    if (this.targetPortal)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            entity.rigidbody.mass = 10;
            entity.highlight.visible = false;
            this.HighlightActivity(false);
            this.targetPortal.Exec(1, "Collision",entity.id, scene.name, transform.scale.x);
        }
    }
    else if (this.trashcan)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            entity.rigidbody.mass = 10;
            entity.highlight.visible = false;
            this.HighlightActivity(false);
            scene.RemoveEntity(entity.id, 2);
            this.trashcan = 0;
        }
    }
    // Just deselect all entities and return them to original positions.
    var length = this.entities.length;
    for (var i = 0; i < length; ++i)
    {
        var ent = scene.EntityById(this.entities.pop());
        ent.placeable.transform = this.originalTransform.pop();
        ent.rigidbody.mass = 10;
        ent.highlight.visible = false;
        this.HighlightActivity(false);
    }
}
// </MOUSE HANDLERS>

function GetActiveCameraId()
{
    // Hax for now..
    var freelookcameraentity = scene.GetEntityByName("FreeLookCamera");
    var avatarcameraentity = scene.GetEntityByName("AvatarCamera");

    if(freelookcameraentity != null && freelookcameraentity.camera.IsActive())
        return freelookcameraentity.id;
    if(avatarcameraentity != null && avatarcameraentity.camera.IsActive())
        return avatarcameraentity.id;
    return -1;
}

function DegToRad(deg)
{
    return deg * (Math.PI / 180.0);
}

ObjectGrab.prototype.HighlightActivity = function(Boolean)
{
    if (Boolean)
    {
        var portal1, portal2, portal3, portal4, trash;
        portal1 = scene.EntityByName("OviReuna1");
        portal2 = scene.EntityByName("OviReuna2");
        portal3 = scene.EntityByName("OviReuna3");
        portal4 = scene.EntityByName("OviReuna4");
        trash = scene.EntityByName("Trashcan");

        var color1 = new Color(0,0.7,0.8);
        var color2 = new Color(0,0.7,0.8);
        portal1.GetOrCreateComponent("EC_Highlight", 2, false);
        portal1.highlight.outlineColor = color1;
        portal1.highlight.visible = true;

        portal2.GetOrCreateComponent("EC_Highlight", 2, false);
        portal2.highlight.outlineColor = color1;
        portal2.highlight.visible = true;

        portal3.GetOrCreateComponent("EC_Highlight", 2, false);
        portal3.highlight.outlineColor = color1;
        portal3.highlight.visible = true;

        portal4.GetOrCreateComponent("EC_Highlight", 2, false);
        portal4.highlight.outlineColor = color1;
        portal4.highlight.visible = true;

        trash.GetOrCreateComponent("EC_Highlight", 2, false);
        trash.highlight.outlineColor = color1;
        trash.highlight.visible = true;
    }
    else
    {
        var portal1, portal2, portal3, portal4, trash;
        portal1 = scene.EntityByName("OviReuna1");
        portal2 = scene.EntityByName("OviReuna2");
        portal3 = scene.EntityByName("OviReuna3");
        portal4 = scene.EntityByName("OviReuna4");
        trash = scene.EntityByName("Trashcan");

        portal1.highlight.visible = false;
        portal1.Exec(1, "update");
        portal2.highlight.visible = false;
        portal2.Exec(1, "update");
        portal3.highlight.visible = false;
        portal3.Exec(1, "update");
        portal4.highlight.visible = false;
        portal4.Exec(1, "update");
        trash.highlight.visible = false;
    }

}


