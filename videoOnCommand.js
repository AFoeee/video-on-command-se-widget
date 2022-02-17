/* 
 * A version of the 'Video On Command' widget originally written by Benno.
 * This code builds on Suerion's variation of the said widget (v3).
 * 
 * Special thanks to Benno, Suerion, lx, thefyrewire, Reboot0, SquidCharger and 
 * ca11.
 */


/* Prefixes defined in 'Fields' are only taken into account if they are also
 * specified in one of the two lists below. They're prioritized in the same order
 * as they appear in the list. */
const videoPrefixes = [
  "video1", 
  "video2", 
  "video3", 
  "video4", 
  "video5"
];

const audioPrefixes = [
  "audio1", 
  "audio2", 
  "audio3", 
  "audio4", 
  "audio5"
];

let allowed = false;                // Blocks the widget when busy.
const mediaCommands = [];           // Holds all types of MediaCommand objects.

let isUsableByEveryone;             // If true, everyone can trigger the widget.
let isUsableByMods;
let isUsableByVips;
let isUsableBySubs;
let otherUsers;                     // Those users can trigger the widget, too.
let blockedUsers;                   // Those users are ignored by the widget.
let isCaseIgnored;                  // If true, the 'i' flag is set in RegExp.


/* Triggers CSS animations by adding animate.css classes. Their effect is 
 * sustained as long as they're attached to the element. Therefore, they are 
 * only removed to immediately replace them with other animate.css classes. */
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


/* Prepares a string to be used in a RegExp by escaping problematic characters. 
 * (Found in Mozilla's RegExp guide.) */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// Uses the input of a media field to test whether media was added to it.
function isMediaFieldPopulated(input) {
  return (input && (Array.isArray(input) ? (input.length > 0) : true));
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
  
  regex;
  
  constructor(
      commandStr, url, volumePct, cooldownSec, comparisonMode = "strict") {
    
    if (new.target === MediaCommand) {
      throw TypeError("new of abstract class MediaCommand.");
    }
    
    this.commandStr = commandStr;
    this.#url = url;
    this.normalizedVolume = volumePct / 100;
    this.cooldownMillis = cooldownSec * 1000;
    
    /* Defines which characters are ignored, when they directly surround the 
     * command. The punctuation was added to the regex group for user convenience 
     * only. */
    const reLookbehind = "(?<=[.,;:!? ]|^)";
    const reLookahead = "(?=[.,;:!?' ]|$)";
    
    let reStr;
    
    // The selected search pattern decides when the command is triggered.
    switch (comparisonMode) {
      case 'strict': 
          reStr = "^" + escapeRegExp(commandStr) + "$";
          break;
          
      case 'explicitlyStartsWith': 
          // The lookahead is appended to prevent false-positive results.
          reStr = "^" + escapeRegExp(commandStr) + reLookahead;
          break;
          
      case 'startsWith': 
          reStr = "^" + escapeRegExp(commandStr);
          break;
          
      case 'someWord': 
          reStr = reLookbehind + escapeRegExp(commandStr) + reLookahead;
          break;
          
      case 'someWordStartsWith': 
          reStr = reLookbehind + escapeRegExp(commandStr);
          break;
          
      case 'includes': 
          reStr = escapeRegExp(commandStr);
          break;
          
      case 'custom': 
          reStr = commandStr;
          break;
          
      default: 
          throw new Error(
              "MediaCommand constructor encountered an unknown switch value: " + 
              comparisonMode);
    }
    
    /* The 'i' flag indicates that case should be ignored while attempting a 
     * match in a string. */
    this.regex = new RegExp(reStr, isCaseIgnored ? 'i' : undefined);
  }
  
  /* Sets a global cooldown and an individual cooldown. To avoid unnecessary 
   * calculations, each is represented by an epoch time that marks the moment, 
   * when its respective cooldown has ended. Later code then simply compares 
   * those results to the current epoch time. */
  activateCooldown() {
    const now = Date.now();
    
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
  
  /* If an array of media is provided, a random element is picked. (That's the 
   * case when the field's "multiple" parameter is true.) */
  get url() {
    if (Array.isArray(this.#url)) {
      const randomIndex = Math.floor(Math.random() * this.#url.length);
      return this.#url[randomIndex];
    }
    return this.#url;
  }
  
  set url(newUrl) {
    this.#url = newUrl;
  }
  
  isTriggeredBy(msg) {
    return this.regex.test(msg);
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
    const hideVideoElmt = 
        () => animateCss(VideoCommand.videoElmt, "{{animationOut}}", 0);
    
    // Ensures a defined initial state.
    hideVideoElmt();
    
    // When a video playback starts, trigger the in-animation.
    VideoCommand.videoElmt.onplay = 
        () => animateCss(VideoCommand.videoElmt, "{{animationIn}}", {{timeIn}});
    
    // When an error occurs, unblock the widget.
    VideoCommand.videoElmt.onerror = () => {
      hideVideoElmt();      // Otherwise the next in-animation would be skipped.
      allowed = true;
      
      throw VideoCommand.videoElmt.error;
    };
    
    // When a video ends, trigger the out-animation.
    VideoCommand.videoElmt.onended = async () => {
      try { 
        await animateCss(VideoCommand.videoElmt, "{{animationOut}}", {{timeOut}});
      } finally {
        /* Unblock the widget only after the out-animation has finished. Otherwise
         * there would be a chance that it's interrupted. */
        allowed = true;
      }
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
    const sfx = new Audio(this.url);
    sfx.volume = this.normalizedVolume;
    
    // When the audio playback ends, unblock the widget.
    sfx.onended = () => { 
      allowed = true;
    };
    
    // When an error occurs, unblock the widget, too.
    sfx.onerror = () => {
      allowed = true;
      throw sfx.error;
    };
    
    allowed = false;
    
    sfx.play();
    
    this.activateCooldown();
  }
}


function onWidgetLoad(obj) {
  const fieldData = obj.detail.fieldData;
  
  otherUsers = fieldData.otherUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");
  
  blockedUsers = fieldData.blockedUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");
  
  isUsableByEveryone = (fieldData.permissionsMode === "unrestricted");
  isUsableByMods = fieldData.permissionLvl_mods;
  isUsableByVips = fieldData.permissionLvl_vips;
  isUsableBySubs = fieldData.permissionLvl_subs;
  
  isCaseIgnored = (fieldData.caseInsensitivityMode === "enabled");
  //console.log(`Widget is case-${isCaseIgnored ? "IN" : ""}sensitive.`);
  
  // Initialize MediaCommands and ignore any command without associated URL(s).
  videoPrefixes.forEach((prefix) => {
    //console.log(`Start initialization for video prefix '${prefix}'.`);
    
    let url = fieldData[`${prefix}_url`];
    
    if (isMediaFieldPopulated(url)) {
      mediaCommands.push(
          new VideoCommand(
              fieldData[`${prefix}_command`], 
              url, 
              fieldData[`${prefix}_volume`], 
              fieldData[`${prefix}_cooldown`], 
              fieldData[`${prefix}_comparisonMode`]));
    }
  });
  
  audioPrefixes.forEach((prefix) => {
    //console.log(`Start initialization for audio prefix '${prefix}'.`);
    
    let url = fieldData[`${prefix}_url`];
    
    if (isMediaFieldPopulated(url)) {
      mediaCommands.push(
          new AudioCommand(
              fieldData[`${prefix}_command`], 
              url, 
              fieldData[`${prefix}_volume`], 
              fieldData[`${prefix}_cooldown`], 
              fieldData[`${prefix}_comparisonMode`]));
    }
  });
  
  // Unblock the widget when successfully initialized.
  allowed = true;
}


function onMessage(msg) {
  if (!allowed) {
    //console.log("Widget is currently blocked.");
    return;
  }
  
  if (MediaCommand.isOnGlobalCooldown()) {
    //console.log("Global cooldown is still running.");
    return;
  }
  
  // Blocked users are rejected.
  if (msg.usernameOnList(blockedUsers)) {
    //console.log(`'${msg.username}' is on blocked users list.`);
    return;
  }
  
  // Check if the user has enough permissions for the selected mode.
  if (isUsableByEveryone || 
      (isUsableBySubs && msg.isSubscriber()) || 
      (isUsableByVips && msg.isVIP()) || 
      (isUsableByMods && msg.isModerator()) || 
      msg.isBroadcaster() || 
      msg.usernameOnList(otherUsers)) {
    
    /* The string comparision has to happen prior to the evaluation of the
     * individual cooldown state, because otherwise the whole purpose of a cooldown
     * is undermined. (If two commands have the same trigger phrase and the first
     * one is on cooldown, the second one would be choosen instead.) */
    let mediaCmd = mediaCommands.find((cmd) => cmd.isTriggeredBy(msg.text));
    
    if (!(mediaCmd instanceof MediaCommand)) {
      //console.log("No MediaCommand (with an associated URL) reported a match.");
      return;
    }
    
    if (mediaCmd.isOnCooldown()) {
      //console.log(`'${mediaCmd.commandStr}' is still on cooldown.`);
      return;
    }
    
    //console.log(`'${mediaCmd.commandStr}' is executed.`);
    
    mediaCmd.play();
    
  } /* else {
    console.log(`'${msg.username}' has insufficient permissions.`);
  } */
}
