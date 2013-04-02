
function Switcher(entity, comp)
{
	this.me = entity;
	this.targetScene = null;
	this.objectGrabbed = false;
	this.userName = null;
	this.mySceneName = "notInitialized";
    this.isServer = server.IsRunning();

	if (this.isServer)
    {
        this.ServerInit();
    }
    else
    {
        this.ClientInit();
    }
}

Switcher.prototype.ClientInit = function()
{
    // Sidestep to get proper identifier from previous scene
    this.userName = this.me.name;
    this.me.name = "camdisplaywall";

    input.TopLevelInputContext().MouseLeftReleased.connect(this, this.mouseLeftRelease);
    input.TouchBegin.connect(this, this.OnTouchBegin);
    //input.TouchUpdate.connect(this, this.OnTouchUpdate);
    //input.TouchEnd.connect(this, OnTouchEnd);

    //client.SwitchScene.connect(this, this.setVisible);
    frame.Updated.connect(this, this.checkParent);
    
    this.me.Action("objectGrabbed").Triggered.connect(this, this.setObjectGrabStatus);
    this.me.Action("Collision").Triggered.connect(this, this.handleCollision);

   	//this.userName = Math.random();
   	this.mySceneName = this.me.ParentScene().name;

    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");
}

Switcher.prototype.ServerInit = function()
{
	print("[Switcher script] Server init");
}

Switcher.prototype.checkParent = function(event)
{
    if (framework.Scene().MainCameraScene().name ==  this.mySceneName)
    {
        me.ParentScene().EntityByName("camdisplaywall").placeable.visible = true;
        var parentReference = this.me.placeable.parentRef;
        parentReference.ref = scene.EntityByName("PortalCamera-" + this.userName);
        this.me.placeable.parentRef = parentReference;
        var matnameBack = "FreeLookCamera_portalBack_tex_mat"; //XXX add mat name getter to EC_RttTarget
        this.me.mesh.SetMaterial(1, matnameBack);
    }
    else
    {
        me.ParentScene().EntityByName("camdisplaywall").placeable.visible = false;
    }
}

Switcher.prototype.mouseLeftPress = function(event)
{
	
}

Switcher.prototype.mouseLeftRelease = function(event)
{
	if (this.mySceneName != framework.Scene().MainCameraScene().name)
            return;
    if (this.objectGrabbed == 1)
    {
        print("ObjectGrabbed still! Returning!");
        return;
    }
    //print("Mouse left release in switcher! " + this.me.name);
    scene = framework.Scene().MainCameraScene();
    if (scene.name != "127.0.0.1-2345-udp")
    {
        var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
        if(raycastResult.entity != null && raycastResult.entity == this.me)
        {
            var privateScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
            if (privateScene == null)
                privateScene = framework.Scene().GetScene("localhost-2345-udp");
            if (privateScene)
            {
                //print("Changing back to private scene!");
                client.EmitSwitchScene(privateScene.name);
                //me.ParentScene().EntityByName("camdisplaywall").placeable.visible = false;
            }
            else
            {
                //print("Logging in back to private scene!");
                var ip = "127.0.0.1";
                client.Connected.connect(newCon);
                client.Login(ip, 2345,"lal", "pass", "udp");
            }
        }
    }
}

Switcher.prototype.OnTouchBegin = function(event)
{
	
}

Switcher.prototype.newCon = function()
{
	
}

Switcher.prototype.connected = function()
{
	
}

Switcher.prototype.setVisible = function(name)
{
	if (name == this.mySceneName)
    {
        me.ParentScene().EntityByName("camdisplaywall").placeable.visible = true;
    }
    else
    {
        me.ParentScene().EntityByName("camdisplaywall").placeable.visible = false;
    }
}

Switcher.prototype.setObjectGrabStatus = function(state)
{
	this.objectGrabbed = state;
}

Switcher.prototype.handleCollision = function(entityID, sceneName, scale)
{
    var ent = framework.Scene().GetScene(sceneName).EntityById(entityID);
    if (ent)
    {
        var otherScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
        if (otherScene)
        {
            var camera = null;
            if (!(camera = otherScene.GetEntityByName("AvatarCamera")))
            {
                if (!(camera = otherScene.GetEntityByName("FreeLookCamera")))
                {
                    print("No camera found from target scene. Unable to copy entity.")
                    return;
                }
            }

            // Calculate position in front of the active scene camera.
            var camerapos = camera.placeable.WorldPosition();
            var worldOrient = camera.placeable.Orientation();
            var suunta = worldOrient.Mul(otherScene.ForwardVector());
            var uusSuunta = suunta.Mul(10);
            var uusPaikka = uusSuunta.Add(camerapos);
            uusPaikka.y += Math.random()*3;

            // Create new entity to target scene.
            var Entity = otherScene.CreateEntity(scene.NextFreeId(), ["EC_Placeable", "EC_Mesh", "EC_Name", "EC_Rigidbody"]);
            if (Entity)
            {
                // Set placeable parameters. Random position.
                var oldTransform = Entity.placeable.transform;
                oldTransform.pos = uusPaikka;
                oldTransform.scale = ent.placeable.transform.scale;
                Entity.placeable.transform = oldTransform;
                //Entity.placeable.SetPosition(oldTransform.pos);

                // Set same mesh attributes to a new entity as in the entity dragged to portal
                Entity.mesh.SetAdjustScale(ent.mesh.GetAdjustScale());
                Entity.mesh.SetAdjustPosition(ent.mesh.GetAdjustPosition());
                Entity.mesh.SetAdjustOrientation(ent.mesh.GetAdjustOrientation());
                Entity.mesh.meshRef = ent.mesh.meshRef;
                Entity.mesh.meshMaterial = ent.mesh.meshMaterial;

                // Set same name also
                Entity.name = ent.name;

                // Set rigidbody size and mass.
                var size = ent.rigidbody.size;
                Entity.rigidbody.mass = 10;
                Entity.rigidbody.size = size;
                Entity.rigidbody.shapeType = ent.rigidbody.shapeType;
                framework.Scene().GetScene(sceneName).RemoveEntity(entityID);
            }
        }
    }
    objectGrabbed = false;
}