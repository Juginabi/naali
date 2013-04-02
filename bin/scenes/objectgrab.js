// Copyright by Center for Internet Excellence, University of Oulu
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
    this.cameras = {};
    
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
        //frame.Updated.connect(this, this.UpdateSelectionAnimation);
        client.Connected.connect(this, this.ClientConnected);
        client.SwitchScene.connect(this, this.ClientSwitchScene);
        client.Disconnected.connect(this, this.ClientDisconnected);
        this.me.Action("NewTargetScene").Triggered.connect(this, this.NewTargetScene);
        this.CreateInput();
    }
}

ObjectGrab.prototype.NewTargetScene = function(scene, camera)
{
    print(scene + ", " + camera);
    this.cameras[scene] = camera;
    print(this.cameras[scene]);
}

ObjectGrab.prototype.ClientConnected = function(scenename)
{
    // Changes this script to operate with different scene's entities
    scene = framework.Scene().GetScene(scenename);
}

ObjectGrab.prototype.ClientSwitchScene = function(scenename)
{
    // Changes this script to operate with different scene's entities
    print("Client switch scene " + scenename);
    scene = framework.Scene().GetScene(scenename);
}

ObjectGrab.prototype.ClientDisconnected = function(scenename)
{
    // Set scene pointer back to where this script is.
    scene = this.me.ParentScene();
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

    input.TouchBegin.connect(this, this.OnTouchBegin);
    input.TouchUpdate.connect(this, this.OnTouchUpdate);
    input.TouchEnd.connect(this, this.OnTouchEnd);
}

ObjectGrab.prototype.OnTouchBegin = function(event)
{
    this.touchPoints = event.touchPoints();

    // restrict grabbing of objects to specific items in the scene
    var i = 0;
    var entityID = this.GetTargetedEntity(this.touchPoints[0].pos().x(), this.touchPoints[0].pos().y());
    var entity = scene.EntityById(entityID);
    var re1 = new RegExp("^Movable");
    if (entity && entity.name.match(re1))
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
                var raycastResult = scene.ogre.Raycast(this.touchPoints[0].pos().x(), this.touchPoints[0].pos().y(), 0x0fffffff);
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
    // If objects are grabbed and on top of the portal transfer them there.
    if (this.targetPortal)
    {
        var length = this.entities.length;
        for (var i = 0; i < length; ++i)
        {
            var entity = scene.EntityById(this.entities.pop());
            var transform = this.originalTransform.pop();
            entity.placeable.transform = transform;
            if (entity.rigidbody)
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
            if (entity.rigidbody)
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
        if (entity.rigidbody)
            ent.rigidbody.mass = 10;
        ent.highlight.visible = false;
        this.HighlightActivity(false);
    }
}

// Get entity id as projected through viewport
// params: screen co-ordinates
// return: entity id if found, -1 for not found
ObjectGrab.prototype.GetTargetedEntity = function(x, y)
{
    var raycastResult = scene.ogre.Raycast(x, y, 0xffffffff);
    if(raycastResult.entity != null) {
        var re1 = new RegExp("^Movable");
        if (raycastResult.entity.name.match(re1))
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
        if (entity.rigidbody)
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
        if (entity.rigidbody)
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
    var cameraEntity = scene.EntityByName(this.cameras[scene.name]);
    var cam = 0;
    if (cameraEntity)
        cam = cameraEntity.camera;
    else
    {
        cameraEntity = scene.EntityByName("FreeLookCamera");
        cam = cameraEntity.camera;
    }

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
                var raycastResult = scene.ogre.Raycast(event.x, event.y, 0x0FFFFFFF);
                var re1 = new RegExp("^camdisplaywall");
                var re2 = new RegExp("^Trash");
                if (raycastResult.entity && raycastResult.entity.name.match(re1))
                {
                    // Set pointed portal as target portal.
                    if (this.targetPortal)
                        this.targetPortal.Exec(1, "objectGrabbed", 0);

                    this.targetPortal = raycastResult.entity;
                    print("Setting objectgrab status TRUE to " + raycastResult.entity.name);
                    this.targetPortal.Exec(1, "objectGrabbed", 1);
                    
                    tf.pos = raycastResult.entity.placeable.transform.pos;
                    entity.placeable.transform = tf;
                }
                else if (raycastResult.entity && raycastResult.entity.name.match(re2))
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
                    //if (positio.y < 0.6)
                    //    positio.y = 0.6
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
            if (entity.rigidbody)
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
            if (entity.rigidbody)
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
                if (ent.rigidbody)
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
        if (ent.rigidbody)
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
            if (ent.rigidbody)
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
    if (entityID == -1)
        return;
    var entity = scene.EntityById(entityID);
    var re1 = new RegExp("^Movable");
    if (entity.name.match(re1))
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
        if (ent.rigidbody)
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
            if (entity.rigidbody)
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
            if (entity.rigidbody)
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
        if (ent.rigidbody)
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

// Highlights active objects from the main camera scene when object is selected.
ObjectGrab.prototype.HighlightActivity = function(Boolean)
{
    if (Boolean)
    {
        var color1 = new Color(0,0.7,0.8);

        var entityIDs = scene.Entities();
        var re1 = new RegExp("^OviReuna");
        var re2 = new RegExp("^Trash");
        var found = 0;
        var entity = 0;
        
        for (i in entityIDs)
        {
            entity = scene.EntityById(i);
            if (entity.name.match(re1) || entity.name.match(re2))
            {
                entity.GetOrCreateComponent("EC_Highlight", 2, false);
                entity.highlight.outlineColor = color1;
                entity.highlight.visible = true;
            }
        }
    }
    else
    {
        var color1 = new Color(0,0.7,0.8);

        var entityIDs = scene.Entities();
        var re1 = new RegExp("^OviReuna");
        var re2 = new RegExp("^Trash");
        var found = 0;
        var entity = 0;
        
        for (i in entityIDs)
        {
            entity = scene.EntityById(i);
            if (entity.name.match(re1) || entity.name.match(re2))
            {
                entity.highlight.visible = false;
                entity.Exec(1, "update");
            }
        }
    }
}


