if (!server.IsRunning() && !framework.IsHeadless())
{
    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");
}

function ObjectGrab(entity, comp)
{
    this.me = entity;
    this.selectedId = -1;
    //this.originalPosition = new float3();
    //this.originalOrientation = new Quat();
    this.originalTransform = 0;
    this.objectActive = false;
    this.animDirection = true;
    this.targetPortal = 0;

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
    inputContext.MouseLeftReleased.connect(this, this.HandleMouseLeftReleased);
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

    var newPosition = selectedPosition.Add(cameraEntity.placeable.WorldOrientation().Mul(
        new float3(amountX, -amountY, 0)));

    var oldTransform = selectedEntity.placeable.transform;
    oldTransform.pos = newPosition;
    selectedEntity.placeable.transform = oldTransform;
}

// <MOUSE HANDLERS>
ObjectGrab.prototype.HandleMouseMove = function(event)
{
    var entity = scene.EntityById(this.selectedId);
    if (this.objectActive)
    {
        var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
        if(raycastResult.entity != null)
        {
            if (raycastResult.entity.id > 1 && raycastResult.entity.id < 6)
            {
                this.targetPortal = scene.EntityById(raycastResult.entity.id);
                var transform = entity.placeable.transform;
                transform.pos = raycastResult.entity.placeable.transform.pos;
                entity.placeable.transform = transform;
            }
            else if (raycastResult.entity.id == 11)
            {
                this.targetPortal = 0;
                entity.placeable.transform = this.originalTransform;
            }
        }

        //this.MoveSelectedObject(event.relativeX, event.relativeY);
    }
}

ObjectGrab.prototype.HandleMouseLeftPressed = function(event)
{
    if (!this.objectActive)
    {
        var entityId = this.GetTargetedEntity(event.x, event.y);
        if(entityId == -1)
            return;
        this.SelectEntity(entityId);
        this.objectActive = true;
    }
    else
    {
        if (this.targetPortal)
        {
            var entity = scene.EntityById(this.selectedId);
            var transform = entity.placeable.transform;
            this.targetPortal.Exec(1, "Collision",this.selectedId, scene.name, transform.scale.x);
        }
        this.ReleaseSelection(this.entityId);
        this.objectActive = false;
    }

}

ObjectGrab.prototype.HandleMouseLeftReleased = function(event)
{
    //this.ReleaseSelection(this.entityId);
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
