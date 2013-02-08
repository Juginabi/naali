if (!server.IsRunning() && !framework.IsHeadless())
{
    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");
}

function ObjectGrab(entity, comp)
{
    this.me = entity;
    this.selectedId = -1;
    this.entities = [];
    //this.originalPosition = new float3();
    //this.originalOrientation = new Quat();
    this.originalTransform = new Array();
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
    //inputContext.MouseRightPressed.connect(this, this.HandleMouseRightPressed);
    //inputContext.MouseLeftReleased.connect(this, this.HandleMouseLeftReleased);
    inputContext.KeyPressed.connect(this, this.HandleKeyPressed);
    inputContext.KeyReleased.connect(this, this.HandleKeyPressed);
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
    var entity = scene.GetEntity(this.selectedId);
    if(entity == null)
        return;

    var degs = 5;

    var transform = entity.placeable.transform;
    transform.rot.y += degs;
    entity.placeable.transform = transform;
}

// Should be connected to selected input method
// Tested to work with mouse, should work with touch but might not work with
// freehand gestures.
ObjectGrab.prototype.MoveSelectedObject = function(deltaX, deltaY)
{
    var cameraId = GetActiveCameraId();
    if(cameraId == -1)
        return;

    var cameraEntity = scene.GetEntity(cameraId);
    var selectedEntity = scene.GetEntity(this.selectedId);
    if(cameraEntity == null || selectedEntity == null)
        return;

    var mainWindow = ui.MainWindow();
    var windowWidth = mainWindow.width;
    var windowHeight = mainWindow.height;

    var movedX = deltaX * (1 / windowWidth);
    var movedY = deltaY * (1 / windowHeight);

    var fov = cameraEntity.camera.verticalFov;
    var cameraPosition = cameraEntity.placeable.transform.pos;
    var selectedPosition = selectedEntity.placeable.transform.pos;

    var distance = cameraPosition.Distance(selectedPosition);

    var width = (Math.tan(fov/2) * distance) * 2;
    var height = (windowHeight*width) / windowWidth;

    var moveFactor = windowWidth / windowHeight;

    var amountX = width * movedX * moveFactor;
    var amountY = height * movedY * moveFactor;
    var newPosition = selectedPosition.Add(cameraEntity.placeable.WorldOrientation().Mul(new float3(amountX, -amountY, 0)));

    var oldTransform = selectedEntity.placeable.transform;
    oldTransform.pos = newPosition;
    selectedEntity.placeable.transform = oldTransform;
}

// <MOUSE HANDLERS>
ObjectGrab.prototype.HandleMouseMove = function(event)
{
    // If no entities are selected, ignore this event.
    if (this.entities.length != 0)
    {
        this.trashcan = 0;
        var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
        // Check if user is pointing on any of the portals
        if (raycastResult.entity != null && raycastResult.entity.id > 1 && raycastResult.entity.id < 6)
        {
            // Set pointed portal as target portal.
            if (this.targetPortal)
                this.targetPortal.Exec(1, "objectGrabbed", 0);
            this.targetPortal = scene.EntityById(raycastResult.entity.id);
            this.targetPortal.Exec(1, "objectGrabbed", 1);

            var entity = null;
            var len = this.entities.length;
            // Set all chosen entities to be placed over portal
            for (var i = 0; i < len; ++i)
            {
                entity = scene.EntityById(this.entities[i]);
                var transform = entity.placeable.transform;
                transform.pos = raycastResult.entity.placeable.transform.pos;
                transform.pos.z -= 1;
                entity.placeable.transform = transform;
            }
        }
        else if (raycastResult.entity != null && raycastResult.entity.id == 19)
        {
            if (this.targetPortal)
                this.targetPortal.Exec(1, "objectGrabbed", 0);
            this.targetPortal = 0;
            this.trashcan = scene.EntityById(raycastResult.entity.id);
            var entity = null;
            var len = this.entities.length;
            // Set all chosen entities to be placed over portal
            for (var i = 0; i < len; ++i)
            {
                entity = scene.EntityById(this.entities[i]);
                var transform = entity.placeable.transform;
                transform.pos = raycastResult.entity.placeable.transform.pos;
                transform.pos.y += 0.5;
                entity.placeable.transform = transform;
            }
        }

        // If cursor is pointed on floor, reset entity positions to starting positions and set target portals to null.
        else if (raycastResult.entity != null && raycastResult.entity.id == 11)
        {
            if (this.targetPortal)
                this.targetPortal.Exec(1, "objectGrabbed", 0);
            this.targetPortal = 0;
            this.trashcan = 0;
            var len = this.entities.length;
            for (var i = 0; i < len; ++i)
            {
                var entity = scene.EntityById(this.entities[i]);
                var transform = entity.placeable.transform;
                transform = this.originalTransform[i];
                entity.placeable.transform = transform;
            }
        }
    }
    else
    {
        if (this.targetPortal)
            this.targetPortal.Exec(1, "objectGrabbed", 0);
        this.targetPortal = 0;
    }
}
ObjectGrab.prototype.timerMethod = function()
{
    print("Timer!");
    this.timer.singleShot = false;
    this.timer.timeout.connect(this, this.timerMethod);
    this.timer.start(1000);
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
            this.HighlightActivity(false);
            scene.RemoveEntity(entity.id, 2);
            this.trashcan = 0;
        }
        return;
    }

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
                var transform = this.originalTransform.splice(i,1);
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
            this.HighlightActivity(false);
        }
    }
}

ObjectGrab.prototype.HandleMouseLeftReleased = function(event)
{
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


