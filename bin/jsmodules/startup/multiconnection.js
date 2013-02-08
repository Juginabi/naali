if (!server.IsRunning())
{
    client.SwitchScene.connect(changeScene);

    function changeScene(name)
    {
        var targetScene = framework.Scene().GetScene(name);
        if (targetScene)
        {
            var cameraentity = targetScene.GetEntityByName("AvatarCamera");
            if (!cameraentity)
            {
                cameraentity = targetScene.GetEntityByName("PortalCamera");
                if (cameraentity == null)
                {
                    cameraentity = targetScene.GetEntityByName("FreeLookCamera");
                }
            }
            if (cameraentity)
            {
                var camera = cameraentity.camera;
                if (camera)
                    camera.SetActive(camera);
                else
                    print("Unable to set camera active for scene: " + targetScene.name);
            }
        }
    }
}
