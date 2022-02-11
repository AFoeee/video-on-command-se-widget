# VideoOnCommand

My version of the StreamElements "Video On Command" custom widget, originally written by Benno.  
The code builds on Suerion's variation of said widget.

## Description of operation:
This custom widget allows to associate media (video or audio) with chat commands.  
It plays when the corresponding command has been detected in chat.

Furthermore, the streamer can limit the access to particular users or user categories.

## Previously added features:
 - User access level `no restrictions`.
 - A `blocked users` list.
 - Cooldown option for each video.
 - Global cooldown (by Suerion).
 - A total of 15 predefined audio commands (by Suerion).

## New features:
 - Refactored the whole code and added two lists to the JavaScript, which hold field prefixes.  
   Those prefixes coupled with structural conventions in 'Fields', should (hopefully) make it easier to append new media commands (like a Xth video command).
 - Set the number of predefined commands to 5 for each media type. 
 - Added a dropdown list for each media command, which defines how a chat message is compared to the specified command string.  
   This way it is also triggered when the message contains additional content (e.g. *"!lurk till later"* or *"I'm in !lurk"*).
 - Added a case sensitivity option for the string comparison.
 - Media input fields with the "multiple" parameter set to true are now supported.  
   If encountered, a random media is picked from the provided pool.
 - Updated the [animate.css library](https://github.com/animate-css/animate.css) version (3.7.0 -> 4.1.1).
 - Added a debug mode, that prints information to the console (F12).
