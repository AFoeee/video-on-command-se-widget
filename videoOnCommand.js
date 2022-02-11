// This widget is a simple modification of the 'Video on command' widget by Benno.
// The comments that start with 'modified' indicate what I added to the code.
// Basically there were 3 features added:
// - the user lvl 'no restrictions' (so that non-vip users can trigger the widget).
// - cool down options for the videos.
// - a list where users can be specified that are ignored by the widget.

// Thanks alot to Benno for creating the original widget.

// Statement from the original widget:
// This widget contains content of a widget from @lx which was an inspiration for this widget. 
// Thank you very much @thefyrewire and @lx for helping me with this widget.

let userOptions = {};
let channels = [];
let animationIn = 'bounceIn';
let animationOut = 'bounceOut';
let timeIn = 400;
let timeOut = 400;
let allowed = true;

// modified - logs the timestep of the last successful execution.
let command1_lastSuccessEpoch = 0;
let command2_lastSuccessEpoch = 0;

window.addEventListener('onWidgetLoad', function (obj) {
    userOptions = obj['detail']['fieldData'];
    animationIn = userOptions['animationIn'];
    animationOut = userOptions['animationOut'];
    timeIn = userOptions['timeIn'];
    timeOut = userOptions['timeOut'];
    userOptions['channelName'] = obj['detail']['channel']['username'];
    userOptions['otherUsers'] = (userOptions['otherUsers'].toLowerCase()).replace(/\s/g, '').split(",");
    $("#video").hide();
    allowed = true;
  
    // modified - prepare the list of ignored users.
    userOptions['blockedUsers'] = (userOptions['blockedUsers'].toLowerCase()).replace(/\s/g, '').split(",");
});

window.addEventListener('onEventReceived', function (obj) {
    if (obj.detail.listener !== 'message') return;
    let data = obj.detail.event.data;
    let message = data['text'].toLowerCase();
    if (message !== userOptions['command1'] && message !== userOptions['command2'] && message !== userOptions['command3'] && message !== userOptions['command4']) return;
    console.log("Got it! " + message);
    let user = data['nick'].toLowerCase();

    //Preparing userState object containing all user flags
    let userState = {
        'mod': parseInt(data.tags.mod),
        'sub': parseInt(data.tags.subscriber),
        'vip': (data.tags.badges.indexOf("vip") !== -1),
        'broadcaster': (user === userOptions['channelName'])
    };

    if (!allowed) return;

    //modified - added permission level 'everyone'.
    if ((userOptions['managePermissions'] === 'everyone') || (userState.mod && userOptions['managePermissions'] === 'mods') || ((userState.vip || userState.mod) && (userOptions['managePermissions'] == 'vips')) || userState.broadcaster || (userOptions['otherUsers'].indexOf(user) !== -1)) {
        // modified - only execute if user is not ignored.
        if ((userOptions['blockedUsers'].indexOf(user) === -1)) {
            let video = $("#video");
            let source = $("#source");
            allowed = false;
            video[0].pause();

            if (message == userOptions['command1']) {
                // modified - cancel execution if the command is still on cool down.
                if (!command1_isOnCoolDown()) {
                    video[0].load();
                    source.attr('src', '{{video1}}');
                    video[0].volume = {volumevid1}/100;
                    play();
                    command1_lastSuccessEpoch = Date.now();
                } else {
                    allowed = true;
                };
            } else if (message == userOptions['command2']) {
                // modified - cancel execution if the command is still on cool down.
                if (!command2_isOnCoolDown()) {
                    video[0].load();
                    source.attr('src', '{{video2}}');
                    video[0].volume = {volumevid2}/100;
                    play();
                    command2_lastSuccessEpoch = Date.now();
                } else {
                    allowed = true;
                };
            } else if (message == userOptions['command3']) {
                let sfx = new Audio("{{audio1}}");
                sfx.volume = userOptions['volumeaudio1'] * .01;
                sfx.play();
                sfx.onended = function () {
                    allowed = true;
                };
            } else if (message == userOptions['command4']) {
                let sfx2 = new Audio("{{audio2}}");
                sfx.volume = userOptions['volumeaudio2'] * .01;
                sfx2.play();
                sfx2.onended = function () {
                    allowed = true;
                }    
            };
    	};
    };
    
    function play() {
        let video = $("#video");
        video.addClass(animationIn + ' animated', timeIn)
            .show(0, timeIn)
            .removeClass(animationIn)
            .get(0).play();
        video.on('ended', function () {
            video.addClass(animationOut, timeOut)
                .removeClass(animationOut + " animated", timeOut)
                .hide(0, timeOut);
            allowed = true;
        });
    }

    // modified - the command isn't executed as long as this returns true.
    function command1_isOnCoolDown() {
        let elapsedMillis = Date.now() - command1_lastSuccessEpoch;
        let coolDownMillis = {cooldown1}*1000;
        
        if (elapsedMillis > coolDownMillis) {
            return false;
        } else {
            console.log("Command1 was executed " + elapsedMillis + " milliseconds ago and is therefore still on cool down. (Total cool down: " + coolDownMillis + " milliseconds.)");
            return true;
        };
    }

    // modified - the command isn't executed as long as this returns true.
    function command2_isOnCoolDown() {
      	let elapsedMillis = Date.now() - command2_lastSuccessEpoch;
        let coolDownMillis = {cooldown2}*1000;
        
        if (elapsedMillis > coolDownMillis) {
            return false;
        } else {
            console.log("Command2 was executed " + elapsedMillis + " milliseconds ago and is therefore still on cool down. (Total cool down: " + coolDownMillis + " milliseconds.)");
            return true;
        };
    }
});

