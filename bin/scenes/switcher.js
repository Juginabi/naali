if (!server.IsRunning())
{
    // input.TopLevelInputContext().MouseLeftPressed.connect(mouseLeftPress);
    input.TopLevelInputContext().MouseLeftReleased.connect(mouseLeftRelease);
    client.SwitchScene.connect(setVisible);
    frame.Updated.connect(checkParent);
    this.me.Action("objectGrabbed").Triggered.connect(setObjectGrabStatus);
    this.me.Action("Collision").Triggered.connect(handleCollision);
    //input.TouchUpdate.connect(checkParent);
    input.TouchBegin.connect(this, OnTouchBegin);
    //input.TouchUpdate.connect(this, this.OnTouchUpdate);
    //input.TouchEnd.connect(this, OnTouchEnd);

    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");

    var objectGrabbed = false;

    function checkParent()
    {
        //print("Setting freelookCamera parent! " + me.placeable.parentRef.ref);
        var parentReference = me.placeable.parentRef;
        parentReference.ref = me.ParentScene().EntityByName("PortalCamera");
        me.placeable.parentRef = parentReference;
        var matnameBack = "FreeLookCamera_portalBack_tex_mat"; //XXX add mat name getter to EC_RttTarget
        me.mesh.SetMaterial(1, matnameBack);
        //print("Set parent: " + me.placeable.parentRef.ref);
    }

    function mouseLeftPress(event)
    {
    
    } // Function mouseleftpress body ends

    function mouseLeftRelease(event)
    {
        if (objectGrabbed == 1)
        {
            print("ObjectGrabbed still! Returning!");
            return;
        }
        print("Mouse left release in switcher!");
        scene = framework.Scene().MainCameraScene();
        if (scene.name != "127.0.0.1-2345-udp")
        {
            var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
            if(raycastResult.entity != null && raycastResult.entity.name == "camdisplaywall")
            {
                var privateScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
                if (privateScene == null)
                    privateScene = framework.Scene().GetScene("localhost-2345-udp");
                if (privateScene)
                {
                    print("Changing back to private scene!");
                    client.EmitSwitchScene(privateScene.name);
                    me.ParentScene().EntityByName("camdisplaywall").placeable.visible = false;
                }
                else
                {
                    print("Logging in back to private scene!");
                    var ip = "127.0.0.1";
                    client.Connected.connect(newCon);
                    client.Login(ip, 2345,"lal", "pass", "udp");
                }
            }
        }
    }

    function OnTouchBegin(event)
    {
        scene = framework.Scene().MainCameraScene();
        if (scene.name != "127.0.0.1-2345-udp")
        {
            var touchPoints = event.touchPoints();
            var raycastResult = scene.ogre.Raycast(touchPoints[0].pos().x(), touchPoints[0].pos().y(), 0xffffffff);
            if(raycastResult.entity != null && raycastResult.entity.name == "camdisplaywall")
            {
                var privateScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
                if (privateScene == null)
                    privateScene = framework.Scene().GetScene("localhost-2345-udp");
                if (privateScene)
                {
                    print("Changing back to private scene!");
                    client.EmitSwitchScene(privateScene.name);
                    me.ParentScene().EntityByName("camdisplaywall").placeable.visible = false;
                }
                else
                {
                    print("Logging in back to private scene!");
                    var ip = "127.0.0.1";
                    client.Connected.connect(newCon);
                    client.Login(ip, 2345,"lal", "pass", "udp");
                }
            }
        }
    } // Function mouseleftpress body ends

    function newCon()
    {
        frame.DelayedExecute(1).Triggered.connect(connected);
    }

    function connected()
    {
        var Entity = me.ParentScene().EntityByName("camdisplaywall");
    	var privateScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
    	var portalView = privateScene.EntityByName("FreeLookCamera", 0);
    	portalView.camera.SetActive();
    	var rttBack = portalView.GetOrCreateComponent("EC_RttTarget");
    	//rttBack = portalView.rtttarget;
        rttBack.textureName = "FreeLookCamera_portalBack_tex";
        rttBack.size_x = 400;
        rttBack.size_y = 300;
        rttBack.PrepareRtt();
        rttBack.SetAutoUpdated(true);
        var matnameBack = rttBack.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
        Entity.mesh.SetMaterial(1, matnameBack);
    	client.Connected.disconnect(connected);
    	Entity.placeable.visible = false;
    }

    function setVisible(name)
    {
    	if (name == me.ParentScene().name)
    	{
            me.ParentScene().EntityByName("camdisplaywall").placeable.visible = true;
    	}
    	else
    	{
            me.ParentScene().EntityByName("camdisplaywall").placeable.visible = false;
    	}
    }

    function setObjectGrabStatus(state)
    {
        print("Switcher setting object grab status to " + state);
        objectGrabbed = state;
    }

    function handleCollision(entityID, sceneName, scale)
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
}



