/* 
 * A version of the 'Video On Command' widget originally written by Benno.
 * This code builds on Suerion's variation of the previously mentioned widget.
 * 
 * Special thanks to Benno, Suerion, lx, thefyrewire, SquidCharger and ca11.
 */


/* Prefixes defined in 'Fields' are only taken into account if they are also
 * specified in one of the two lists below. They're prioritized in the same order
 * as they appear in the list. */
let videoPrefixes = [
  "video1", 
  "video2", 
  "video3", 
  "video4", 
  "video5"
];

let audioPrefixes = [
  "audio1", 
  "audio2", 
  "audio3", 
  "audio4", 
  "audio5"
];

let allowed = false;                // Blocks the widget if necessary.
let fieldData = {};                 // Config data from 'Fields'.
let channelName = "";               // Username of the broadcaster.
let mediaCommands = [];             // Holds all types of MediaCommand objects.


/* Triggers CSS animations by adding animate.css classes. Their effect is 
 * sustained as long as they're attached to the element. Therefore, they are 
 * only removed shortly before being replaced by other animate.css classes. */
function animateCss(node, animationName, duration = 1, prefix = 'animate__') {
  // animate.css classes do have a prefix (since version 4.0).
  const envCls = `${prefix}animated`;
  const animationCls = `${prefix}${animationName}`;
  
  // Remove all applied animate.css classes.
  node.className = node.className
      .split(" ")
      .filter((cls) => !cls.startsWith(prefix))
      .join(" ");
  
  // Promise resolves when animation has ended.
  return new Promise((resolve, reject) => {
    node.addEventListener('animationend', (event) => {
      event.stopPropagation();
      resolve('Animation ended');
    }, {once: true});
    
    node.style.setProperty('--animate-duration', `${duration}s`);
    node.classList.add(envCls, animationCls);       // Starts CSS animation.
  });
}


// Convenience function for debugging mode.
function log(msg) {
  if (fieldData.debugMode !== "enabled") return;
  
  console.log(msg);
}


/* Abstract base class, which defines ...
 * ... general media attributes.
 * ... how the command is triggered.
 * ... how the cooldown mechanism works. 
 * ... which url is used (if multiple are provided). */
class MediaCommand {
  static globalCooldownMillis = {{globalcooldown}} * 1000;
  static globalCooldownEndEpoch = 0;
  
  cooldownMillis;
  cooldownEndEpoch = 0;
  
  commandStr;
  #url;
  normalizedVolume;
  
  isTriggeredBy;
  
  constructor(
      commandStr, 
      url, 
      volumePct, 
      cooldownSec, 
      comparisonMode = "strict", 
      isCaseSensitive) {
    
    if (new.target === MediaCommand) {
      throw TypeError("new of abstract class MediaCommand.");
    }
    
    this.commandStr = commandStr;
    this.#url = url;
    this.normalizedVolume = volumePct / 100;
    this.cooldownMillis = cooldownSec * 1000;
    
    // The function that gets selected determines how a match is defined.
    if (comparisonMode === 'regex') {
      /* Converting a regex string to lower case is problematic as it might 
       * change the meaning. Therefore the 'i' flag is used, which indicates
       * that case should be ignored while attempting a match in a string. */
      let re = new RegExp(
          commandStr, 
          isCaseSensitive ? undefined : 'i');
      
      this.isTriggeredBy = (msg) => re.test(msg);
      
    } else {
      /* Case insensitivity is achieved by converting both strings to lower case.
       * The convertion of the chat message happens through a decorator wrapper. */
      let cmd = isCaseSensitive ? commandStr : commandStr.toLowerCase();
      let compFunc;
      
      switch (comparisonMode) {
        case 'strict': 
            compFunc = (msg) => (msg === cmd);
            break;
            
        case 'firstWord': 
            compFunc = (msg) => (msg.trimStart().split(' ', 1)[0] === cmd);
            break;
            
        case 'firstWordStartsWith': 
            compFunc = (msg) => msg.trimStart().startsWith(cmd);
            break;
            
        case 'someWord': 
            compFunc = (msg) => msg.split(' ').includes(cmd);
            break;
            
        case 'someWordStartsWith': 
            compFunc = 
                (msg) => msg.split(' ').some(
                    (str) => str.startsWith(cmd));
            break;
            
        default: 
            throw new Error(
                this.constructor.name + 
                " constructor encountered an unknown switch value: " + 
                comparisonMode);
      }
      
      if (isCaseSensitive) {
        this.isTriggeredBy = compFunc;
      } else {
        // Said decorator wrapper, that converts the chat msg to lower case.
        this.isTriggeredBy = (msg) => compFunc(msg.toLowerCase());
      }
    }
  }
  
  get url() {
    /* If an array of media is provided a random element is picked. (That's the 
     * case when the field's "multiple" parameter is true.) */
    if (Array.isArray(this.#url)) {
      const randomIndex = Math.floor(Math.random() * this.#url.length);
      return this.#url[randomIndex];
    }
    return this.#url;
  }
  
  set url(newUrl) {
    this.#url = newUrl;
  }
  
  /* Sets a global cooldown and an individual cooldown. To avoid unnecessary 
   * calculations, each is represented by an epoch time that marks the moment, 
   * when its respective cooldown has ended. Later code then simply compares 
   * those results to the current epoch time. */
  activateCooldown() {
    let now = Date.now();
    
    // Global cooldown.
    MediaCommand.globalCooldownEndEpoch = 
        now + MediaCommand.globalCooldownMillis;
    
    // Individual cooldown.
    this.cooldownEndEpoch = now + this.cooldownMillis;
  }
  
  static isOnGlobalCooldown() {
    return (Date.now() < MediaCommand.globalCooldownEndEpoch);
  }
  
  isOnCooldown() {
    return (Date.now() < this.cooldownEndEpoch);
  }
  
  // Abstract method.
  play() {
    throw new Error("play() wasn't implemented by the child class.");
  }
}


class VideoCommand extends MediaCommand {
  static videoElmt = document.getElementById("video");
  
  static {
    // Hide video element immediately (therefore, 0s duration).
    let hideVideoElmt = 
        () => animateCss(VideoCommand.videoElmt, "{{animationOut}}", 0);
    
    hideVideoElmt();
    
    // When a video playback starts, trigger the in animation.
    VideoCommand.videoElmt.onplay = () => {
      animateCss(VideoCommand.videoElmt, "{{animationIn}}", {{timeIn}});
    };
    
    // When an error occurs, unblock the widget.
    VideoCommand.videoElmt.onerror = () => {
      hideVideoElmt();
      allowed = true;
      
      throw VideoCommand.videoElmt.error;
    };
    
    // When a video ends, trigger the out animation.
    VideoCommand.videoElmt.onended = () => {
      let animateCssPromise = 
          animateCss(VideoCommand.videoElmt, "{{animationOut}}", {{timeOut}});
      
      /* Unblock the widget only after the out animation has finished. Otherwise
       * there would be a chance that it's interrupted. */
      animateCssPromise
          .finally(() => { allowed = true; });
    };
  }
  
  async play() {
    VideoCommand.videoElmt.pause();
    
    VideoCommand.videoElmt.src = this.url;
    VideoCommand.videoElmt.volume = this.normalizedVolume;
    
    // 'load() will reset the element and rescan the available sources ...'
    VideoCommand.videoElmt.load();
    
    allowed = false;
    
    VideoCommand.videoElmt.play();
    
    this.activateCooldown();
  }
}


class AudioCommand extends MediaCommand {
  play() {
    let sfx = new Audio(this.url);
    sfx.volume = this.normalizedVolume;
    
    allowed = false;
    
    // When the audio playback ends, unblock the widget.
    sfx.onended = () => { 
      allowed = true;
    };
    
    // When an error occurs, unblock the widget, too.
    sfx.onerror = () => {
      allowed = true;
      throw sfx.error;
    };
    
    sfx.play();
    
    this.activateCooldown();
  }
}


window.addEventListener('onWidgetLoad', function (obj) {
  fieldData = obj.detail.fieldData;
  
  // Convert user lists to arrays.
  fieldData.otherUsers = fieldData.otherUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");
  fieldData.blockedUsers = fieldData.blockedUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");
  
  channelName = obj.detail.channel.username;
  
  let isCaseSensitive = (fieldData.caseSensitivity === "enabled");
  
  // Initialize MediaCommands and ignore any command without associated URL(s).
  videoPrefixes.forEach((prefix) => {
    log(`Start initialization for video prefix '${prefix}'.`);
    
    let url = fieldData[`${prefix}_url`];
    if (url) {
      mediaCommands.push(new VideoCommand(
          fieldData[`${prefix}_command`], 
          url, 
          fieldData[`${prefix}_volume`], 
          fieldData[`${prefix}_cooldown`], 
          fieldData[`${prefix}_comparisonMode`], 
          isCaseSensitive));
    }
  });
  
  audioPrefixes.forEach((prefix) => {
    log(`Start initialization for audio prefix '${prefix}'.`);
    
    let url = fieldData[`${prefix}_url`];
    if (url) {
      mediaCommands.push(new AudioCommand(
          fieldData[`${prefix}_command`], 
          url, 
          fieldData[`${prefix}_volume`], 
          fieldData[`${prefix}_cooldown`], 
          fieldData[`${prefix}_comparisonMode`], 
          isCaseSensitive));
    }
  });
  
  // Unblock the widget when successfully initialized.
  allowed = true;
});


window.addEventListener('onEventReceived', function (obj) {
  if (obj.detail.listener !== 'message') return;
  
  if (!allowed) {
    log("Widget is currently blocked.");
    return;
  }
  
  if (MediaCommand.isOnGlobalCooldown()) {
    log("Global cooldown is still running.");
    return;
  }
  
  /* Since string comparison has the potential to be computationally expensive, 
   * it is only executed for users with an sufficient permission level. */
  
  let data = obj.detail.event.data;
  let user = data.nick.toLowerCase();
  
  // Blocked users will always fail.
  if (fieldData.blockedUsers.includes(user)) {
    log(`'${user}' is on blocked users list.`);
    return;
  }
  
  let userState = {
    'mod': parseInt(data.tags.mod), 
    'sub': parseInt(data.tags.subscriber), 
    'vip': data.tags.badges.includes('vip'), 
    'broadcaster': (user === channelName)
  };
  
  if ((fieldData.managePermissions === 'everyone') || 
      (userState.mod && (fieldData.managePermissions === 'mods')) || 
      ((userState.vip || userState.mod) && (fieldData.managePermissions === 'vips')) || 
      userState.broadcaster || 
      fieldData.otherUsers.includes(user)) {
    
    log(`'${user}' has sufficient permission level.`);
    
    let msg = data.text;
    
    /* The string comparision has to happen prior to the evaluation of the
     * individual cooldown state, because otherwise the whole purpose of a cooldown
     * is undermined. (If two commands have the same trigger phrase and the first
     * one is on cooldown, the second one would be choosen instead.) */
    let mediaCmd = mediaCommands.find((cmd) => cmd.isTriggeredBy(msg));
    
    if (!(mediaCmd instanceof MediaCommand)) {
      log ("No MediaCommand (with an associated URL) declared a match.");
      return;
    }
    
    if (mediaCmd.isOnCooldown()) {
      log(`'${mediaCmd.commandStr}' is still on cooldown.`);
      return;
    }
    
    log(`'${mediaCmd.commandStr}' is executed.`);
    
    mediaCmd.play();
  }
});
