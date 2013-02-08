var isServer = server.IsRunning();

if (!isServer)
{
    var inputmapper = this.me.GetOrCreateComponent("EC_InputMapper", 2, false);
    inputmapper.contextPriority = 100;
    inputmapper.takeMouseEventsOverQt = true;
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

function HandleMouseMove(event)
{
    print("Mouse now at " + event.X + "," + event.Y);
}

function HandleMouseLeftPressed(event)
{
    print("Mouse pressed at " + event.X + "," + event.Y);
}

function HandleKeyPressed(event)
{
    print("Key event: " + event.keyCode);
}
