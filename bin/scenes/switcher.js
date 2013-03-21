if (!server.IsRunning())
{
    // input.TopLevelInputContext().MouseLeftPressed.connect(mouseLeftPress);
    input.TopLevelInputContext().MouseLeftReleased.connect(mouseLeftRelease);
    client.SwitchScene.connect(setVisible);
    frame.Updated.connect(checkParent);
    //input.TouchUpdate.connect(checkParent);
    input.TouchBegin.connect(this, OnTouchBegin);
    //input.TouchUpdate.connect(this, this.OnTouchUpdate);
    //input.TouchEnd.connect(this, OnTouchEnd);

    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");

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
        scene = framework.Scene().MainCameraScene();
        if (scene.name != "127.0.0.1-2345-udp")
        {
            var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
            if(raycastResult.entity != null && raycastResult.entity.name == "3D-UI-switch")
            {
                var privateScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
                if (privateScene == null)
                    privateScene = framework.Scene().GetScene("localhost-2345-udp");
                if (privateScene)
                {
                    print("Changing back to private scene!");
                    client.EmitSwitchScene(privateScene.name);
                    me.ParentScene().EntityByName("3D-UI-switch").placeable.visible = false;
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
            if(raycastResult.entity != null && raycastResult.entity.name == "3D-UI-switch")
            {
                var privateScene = framework.Scene().GetScene("127.0.0.1-2345-udp");
                if (privateScene == null)
                    privateScene = framework.Scene().GetScene("localhost-2345-udp");
                if (privateScene)
                {
                    print("Changing back to private scene!");
                    client.EmitSwitchScene(privateScene.name);
                    me.ParentScene().EntityByName("3D-UI-switch").placeable.visible = false;
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
        var Entity = me.ParentScene().EntityByName("3D-UI-switch");
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
        me.ParentScene().EntityByName("3D-UI-switch").placeable.visible = true;
	}
	else
	{
        me.ParentScene().EntityByName("3D-UI-switch").placeable.visible = false;
	}
    }
}

