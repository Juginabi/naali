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
    this.ctrlDown = false;
    this.hoveringText = null;
    this.timer = new QTimer();

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
        if (raycastResult.entity.id >= 12 && raycastResult.entity.id <= 14)
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
    var windowHeight = mainWindow.height;this.selectedId

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
        var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
        // Check if user is pointing on any of the portals
        if (raycastResult.entity && raycastResult.entity.id > 1 && raycastResult.entity.id < 6)
        {
            // Set pointed portal as target portal.
            if (this.targetPortal)
            {
                this.hoveringText = this.targetPortal.GetOrCreateComponent("EC_HoveringText");
                this.hoveringText.Hide();
            }

            this.targetPortal = scene.EntityById(raycastResult.entity.id);
            this.hoveringText = this.targetPortal.GetOrCreateComponent("EC_HoveringText");
            this.hoveringText.backgroundColor = new Color(0.2, 0.2, 0.2, 0.2);
            this.hoveringText.fontColor = new Color(1, 1, 1, 1);
            var pos = this.hoveringText.position;
            pos.x = 0;
            pos.y = -1;
            pos.z = 0.5;
            this.hoveringText.position = pos;
            this.hoveringText.fontSize = 24;
            this.hoveringText.text = "Items to transfer: " + this.entities.length;
            this.hoveringText.Show();

            var entity = null;
            var len = this.entities.length;
            // Set all chosen entities to be placed over portal
            for (var i = 0; i < len; ++i)
            {
                entity = scene.EntityById(this.entities[i]);
                var transform = entity.placeable.transform;
                transform.pos = raycastResult.entity.placeable.transform.pos;
                entity.placeable.transform = transform;
            }
        }
        // If cursor is pointed on floor, reset entity positions to starting positions and set target portals to null.
        else if (raycastResult.entity.id == 11)
        {
            if (this.targetPortal)
            {

                this.hoveringText = this.targetPortal.GetOrCreateComponent("EC_HoveringText");
                this.hoveringText.Hide();
            }
            this.targetPortal = 0;
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
        this.targetPortal = 0;
}
ObjectGrab.prototype.timerMethod = function()
{
    print("Timer!");
    this.timer.singleShot = false;
    this.timer.timeout.connect(this, this.timerMethod);
    this.timer.start(1000);
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
            this.hoveringText.Hide();
            this.targetPortal.Exec(1, "Collision",entity.id, scene.name, transform.scale.x);
        }
        return;
    }

    // restrict grabbing of objects to three dices in the scene.
    var i = 0;
    var entityID = this.GetTargetedEntity(event.x, event.y);
    if (entityID >= 12 && entityID <= 14)
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
        ent.GetOrCreateComponent("EC_Highlight");
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
