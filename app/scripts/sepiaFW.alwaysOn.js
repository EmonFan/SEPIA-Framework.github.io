//Always on special screen mode
function sepiaFW_build_always_on(){
    var AlwaysOn = {};

    var AVATAR_FADE_DELAY = 120000;
    var CONTROLS_FADE_DELAY = 5000;
    var INFO_FADE_DELAY = 5000;
    var ALARM_ANIMATION_ACTIVE = 12000;

    //elements
    var $mainWindow = undefined;
    var $carouselPanes = undefined;
    var $alarmArea = undefined;
    var $topLayer = undefined;
    var $avatar = undefined;
    var $activityArea = undefined;
    var $avatarEyelid = undefined;
    var $avatarMouth = undefined;
    var $clock = undefined;
    var $notes = undefined;
    var $battery = undefined;

    //some states
    AlwaysOn.isOpen = false;
    var mainWasFullscreenOpen = false;
    var mainWasVoiceDisabled = false;
    var avatarIsWaiting = false;
    var avatarIsLoading = false;
    var avatarIsAlarmed = false;

    //some settings
    AlwaysOn.autoEnableVoice = true;
    AlwaysOn.autoLoadOnPowerPlug = true;
    var preventNoteIndicatorFadeIfNotZero = true;       //keep the missed notes indicator alive?

    //Load always-on screen
    AlwaysOn.start = function(){
        SepiaFW.frames.open({ 
            pageUrl: "always-on.html",
            onFinishSetup: AlwaysOn.onFinishSetup,
            onOpen: AlwaysOn.onOpen,
            onClose: AlwaysOn.onClose,
            //onMessageHandler: AlwaysOn.onMessageHandler,              //TODO: use this?
            onMissedMessageHandler: AlwaysOn.onMissedMessageHandler,
            theme: "dark_full"
        });
    }

    //On finish setup (first open)
    AlwaysOn.onFinishSetup = function(){
        //console.log('finish setup');
        //actions on screen click
        $(".sepiaFW-alwaysOn-page, .sepiaFW-alwaysOn-navbar").off().on('click', function(){
            //wake up
            AlwaysOn.onWakeup();
            //deactivate alarm
            AlwaysOn.deactivateAlarm();
        });
        //mic on avatar click
        var micButton = document.getElementById("sepiaFW-alwaysOn-avatar-touch-area");
        SepiaFW.ui.buildDefaultMicLogic(micButton);
        //get some elements
        $mainWindow = $('#sepiaFW-main-window');
        $carouselPanes = $('.sepiaFW-carousel-pane');
        $alarmArea = $('.sepiaFW-alwaysOn-navbar');
        $avatar = $("#sepiaFW-alwaysOn-avatar");
        $topLayer = $avatar.closest('.sepiaFW-top-layer-view');
        $activityArea = $avatar.find('.avatar-activity');
        $avatarEyelid = $avatar.find(".avatar-eyelid");
        $avatarMouth = $avatar.find(".avatar-mouth");
        $clock = $('#sepiaFW-alwaysOn-clock');
        $notes = $('#sepiaFW-alwaysOn-notifications');
        $battery = $('#sepiaFW-alwaysOn-battery');
    }

    //On open
    AlwaysOn.onOpen = function(){
        //console.log('open');
        //prevent screen sleep on mobile
        AlwaysOn.preventSleep();
        //make sure there are no frames - TODO: we should reduce the necessary modifiers!
        mainWasFullscreenOpen = $('.sepiaFW-carousel-pane').hasClass('full-screen');
        $mainWindow.removeClass('sepiaFW-skin-mod');
        $mainWindow.addClass('sepiaFW-ao-mode');
        $topLayer.addClass('sepiaFW-ao-mode');
        $carouselPanes.addClass('full-screen');
        //show avatar and stuff
        if (openFadeTimer) clearTimeout(openFadeTimer);
        openFadeTimer = setTimeout(function(){
            $avatar.css({opacity:'0'}).show().animate({opacity:'1.0'}, {complete:function(){
                fadeOutNavbarControlsAfterDelay(CONTROLS_FADE_DELAY);
                fadeAvatarToRandomPosAfterDelay(AVATAR_FADE_DELAY);
            }, duration: 1000});
        }, 1000);
        //TTS is always on?
        if (SepiaFW.speech){
            mainWasVoiceDisabled = SepiaFW.speech.skipTTS;
            if (AlwaysOn.autoEnableVoice){
                var skipStore = true;
                SepiaFW.speech.enableVoice(skipStore);
            }
        }
        AlwaysOn.isOpen = true;
        //restore some states (only support loading and waiting right now)
        if (avatarIsWaiting){
            AlwaysOn.avatarAwaitingInput();
        }else if (avatarIsLoading){
            AlwaysOn.avatarLoading();
        }
    }
    var openFadeTimer;    

    //On close
    AlwaysOn.onClose = function(){
        //console.log('close');
        //stop reposition script
        if (fadeAvatarTimer) clearTimeout(fadeAvatarTimer);
        $avatar.fadeOut(300);
        //allow sleep again
        AlwaysOn.allowSleep();
        //restore designs - TODO: we should reduce the necessary modifiers!
        $mainWindow.removeClass('sepiaFW-ao-mode');
        $topLayer.removeClass('sepiaFW-ao-mode');
        $mainWindow.addClass('sepiaFW-skin-mod');
        if (!mainWasFullscreenOpen){
            $carouselPanes.removeClass('full-screen');
        }
        //TTS is always on?
        if (SepiaFW.speech){
            var skipStore = true;
            if (mainWasVoiceDisabled) SepiaFW.speech.disableVoice(skipStore);
            else SepiaFW.speech.enableVoice(skipStore);
        }
        //go to my view on close
        //SepiaFW.ui.moc.showPane(0);

        AlwaysOn.isOpen = false;
    }

    //Missed messages handling
    AlwaysOn.onMissedMessageHandler = function(msgInfo){
        //console.log(msgInfo);
        //we only accept error messages and chat-other for now:
        if (msgInfo && msgInfo.name && 
                (msgInfo.name.indexOf('error') >= 0 || msgInfo.name.indexOf('chatOther') >= 0)
            ){
            SepiaFW.ui.addMissedMessage();
            showNotificationsAndFade(INFO_FADE_DELAY, preventNoteIndicatorFadeIfNotZero);
        }
    }

    //Animations and wake controls:

    AlwaysOn.onWakeup = function(){
        //restore nav-bar and restart timer
        fadeOutNavbarControlsAfterDelay(5000);
        //restore avatar to wake
        wakeAvatar();
        //show info items for a while
        showLocalTimeAndFade();
        showNotificationsAndFade(INFO_FADE_DELAY, preventNoteIndicatorFadeIfNotZero);
        showBatteryAndFade();
    }
    AlwaysOn.avatarIdle = function(){
        //reset stuff
        avatarIsWaiting = false;
        avatarIsLoading = false;
        if ($activityArea){
            //restore avatar to wake (because action will follow)
            wakeAvatar();
            $activityArea.removeClass('loading');
            $activityArea.removeClass('listening');
            $activityArea.removeClass('speaking');
            $activityArea.removeClass('waiting');

            //modify by mood
            if (SepiaFW.assistant.getState().moodState == 2){
                $avatarMouth.addClass('sad');
            }else{
                $avatarMouth.removeClass('sad');
            }
        }
    }
    AlwaysOn.avatarLoading = function(){
        AlwaysOn.avatarIdle();
        avatarIsLoading = true;
        if ($activityArea){
            $activityArea.addClass('loading');
        }
    }
    AlwaysOn.avatarSpeaking = function(){
        AlwaysOn.avatarIdle();
        if ($activityArea){
            $activityArea.addClass('speaking');
        }
    }
    AlwaysOn.avatarListening = function(){
        AlwaysOn.avatarIdle();
        if ($activityArea){
            $activityArea.addClass('listening');
        }
    }
    AlwaysOn.avatarAwaitingInput = function(){
        AlwaysOn.avatarIdle();
        avatarIsWaiting = true;
        if ($activityArea){
            $activityArea.addClass('waiting');
        }
    }
    //States
    function wakeAvatar(){
        $avatarEyelid.removeClass('sleep');
        $avatarMouth.removeClass('sleep');
    }
    function makeAvatarSleepy(){
        $avatarEyelid.addClass('sleep');
        $avatarMouth.addClass('sleep');
    }

    //Alarm animation
    AlwaysOn.triggerAlarm = function(){
        //state
        avatarIsAlarmed = true;
        //show animation
        if (alarmTriggerTimer) clearTimeout(alarmTriggerTimer);
        $alarmArea.addClass('sepiaFW-alwaysOn-alarm-anim');
        alarmTriggerTimer = setTimeout(function(){
            //auto-remove after delay - only animation
            removeAlarmAnimation();
        }, ALARM_ANIMATION_ACTIVE);
        //wake up avatar
        wakeAvatar();
    }
    AlwaysOn.deactivateAlarm = function(){
        if (avatarIsAlarmed){
            if (alarmTriggerTimer) clearTimeout(alarmTriggerTimer);
            //stop alarm sound
            if (SepiaFW.audio){
                SepiaFW.audio.stopAlarmSound();
            }
            //remove animation
            removeAlarmAnimation();
            //remove missed event (since the user actively stopped it)
            SepiaFW.ui.addMissedMessage(-1);
        }
    }
    function removeAlarmAnimation(){
        //optics
        $alarmArea.removeClass('sepiaFW-alwaysOn-alarm-anim');
        //state
        avatarIsAlarmed = false;
    }
    var alarmTriggerTimer;

    //Control screen sleep on mobile
    AlwaysOn.preventSleep = function(){
        if (SepiaFW.ui.isCordova){
            //check for plugins
            if (window.plugins.insomnia){
                //console.log('----------- INSOMNIA TRIGGERED -----------');
                window.plugins.insomnia.keepAwake();
            }
            if (StatusBar){
                //console.log('----------- STATUSBAR TRIGGERED -----------');
                StatusBar.hide();
            }
        }
    }
    AlwaysOn.allowSleep = function(){
        if (SepiaFW.ui.isCordova){
            //check for plugins
            if (window.plugins.insomnia){
                //console.log('----------- INSOMNIA TRIGGERED -----------');
                window.plugins.insomnia.allowSleepAgain();
            }
            if (StatusBar){
                //console.log('----------- STATUSBAR TRIGGERED -----------');
                StatusBar.show();
            }
        }
    }

    //Fade out navbar controls slowly after a certain delay
    function fadeOutNavbarControlsAfterDelay(delay){
        var $navBarEntries = $(".sepiaFW-alwaysOn-navbar-entry");
        //stop any running timers and animations and restore opacity
        if (fadeControlsTimer) clearTimeout(fadeControlsTimer);
        $navBarEntries.stop().css({opacity:'1.0'});
        fadeControlsTimer = setTimeout(function(){
            $navBarEntries.stop().animate({opacity:'0'}, {duration: 3000});
        }, delay);
    }
    var fadeControlsTimer;

    //Fade out avatar slowly after a certain delay and respawn at random pos (OLED screen protection)
    function fadeAvatarToRandomPosAfterDelay(delay){
        //stop any running timers and animations and restore opacity
        if (fadeAvatarTimer) clearTimeout(fadeAvatarTimer);
        $avatar.stop().css({opacity:'1.0'});
        fadeAvatarTimer = setTimeout(function(){
            $avatar.stop().animate({opacity:'0'}, {complete: function(){
                //done, get new coordinates
                setNewAvatarRandomPosition();
                //fade in again
                $avatar.stop().animate({opacity:'1.0'},{complete: function(){
                    //restart timer
                    fadeAvatarToRandomPosAfterDelay(delay);
                }, duration: 500});
                //make avatar sleepy
                makeAvatarSleepy();
            }, duration: 1000});
        }, delay);
        //show info items for a while
        showLocalTimeAndFade();
        showNotificationsAndFade(INFO_FADE_DELAY, preventNoteIndicatorFadeIfNotZero);
        showBatteryAndFade();
    }
    var fadeAvatarTimer;

    //Move Avatar to new random position withing view
    function setNewAvatarRandomPosition(){
        var availableHeight = $('#sepiaFW-alwaysOn-view').height();
        var availableWidth = $('#sepiaFW-alwaysOn-view').width();
        var avatarHeigth = $avatar.height();
        var avatarWidth = $avatar.width();
        var newTop = getRandomPixel(availableHeight-avatarHeigth);
        var newLeft = getRandomPixel(availableWidth-avatarWidth);
        $avatar.css({top: newTop, left: newLeft});
    }
    AlwaysOn.moveAvatar = setNewAvatarRandomPosition;

    //Get random integer with pixel tag
    function getRandomPixel(max) {
        return (Math.floor(Math.random() * Math.floor(max))) + "px";
    }

    //Show a clock with local time for a while
    function showLocalTimeAndFade(fadeOutAfterDelay){
        var short = true;
        var timeWithIcon = 
            '<i class="material-icons md-txt">access_time</i>&nbsp;' + SepiaFW.tools.getLocalTime(short);
        $clock.html(timeWithIcon);
        $clock.stop().fadeIn(500, function(){
            if (fadeOutAfterDelay == undefined) fadeOutAfterDelay = INFO_FADE_DELAY;
            if (fadeClockTimer) clearTimeout(fadeClockTimer);
            fadeClockTimer = setTimeout(function(){
                $clock.fadeOut(3000);
            }, fadeOutAfterDelay);
        });
    }
    var fadeClockTimer;

    //Show missed notifications for a while
    function showNotificationsAndFade(fadeOutAfterDelay, keepIfNotZero){
        var missedNotesWithIcon = 
            '<i class="material-icons md-txt">notifications_none</i>&nbsp;' + SepiaFW.ui.getNumberOfMissedMessages();
        $notes.html(missedNotesWithIcon);
        $notes.stop().fadeIn(500, function(){
            if (fadeOutAfterDelay == undefined) fadeOutAfterDelay = INFO_FADE_DELAY;
            if (fadeNotificationsTimer) clearTimeout(fadeNotificationsTimer);
            fadeNotificationsTimer = setTimeout(function(){
                if (!keepIfNotZero || SepiaFW.ui.getNumberOfMissedMessages() <= 0){
                    $notes.fadeOut(3000);
                }
            }, fadeOutAfterDelay);
        });
    }
    var fadeNotificationsTimer;

    //Show battery status for a while
    function showBatteryAndFade(fadeOutAfterDelay){
        if (AlwaysOn.trackPowerStatus){
            var batteryIcon = "battery_alert";
            if (AlwaysOn.batteryPlugStatus){
                batteryIcon = "battery_charging_full";
            }else if (AlwaysOn.batteryLevel > 0.9){
                batteryIcon = "battery_std";
            }else if (AlwaysOn.batteryLevel > 0.75){
                batteryIcon = "battery_std";
            }else if (AlwaysOn.batteryLevel > 0.5){
                batteryIcon = "battery_std";
            }else if (AlwaysOn.batteryLevel > 0.25){
                batteryIcon = "battery_std";
            }
            var batteryWithIcon = 
                '<i class="material-icons md-txt">' + batteryIcon + '</i>&nbsp;' + AlwaysOn.batteryPercentage;
            $battery.html(batteryWithIcon);
            $battery.stop().fadeIn(500, function(){
                if (fadeOutAfterDelay == undefined) fadeOutAfterDelay = INFO_FADE_DELAY;
                if (fadeBatteryTimer) clearTimeout(fadeBatteryTimer);
                fadeBatteryTimer = setTimeout(function(){
                    $battery.fadeOut(3000);
                }, fadeOutAfterDelay);
            });
        }else{
            $battery.hide();
        }
    }
    var fadeBatteryTimer;

    //---------- Battery status API -----------

    var battery = undefined;
    AlwaysOn.trackPowerStatus = false;       //TODO: switchable in settings

    AlwaysOn.batteryLevel = undefined;
    AlwaysOn.batteryPercentage = undefined;
    AlwaysOn.batteryPlugStatus = undefined;

    AlwaysOn.isBatteryStatusSupported = function(){
        return !!navigator.getBattery;      //Note: we only support this API (see below)
    }

    AlwaysOn.setupBatteryStatus = function(){
        if (AlwaysOn.trackPowerStatus){
            //check and if possible activate
            if (AlwaysOn.isBatteryStatusSupported()){
                SepiaFW.debug.info("BatteryStatus supported via 'navigator.getBattery'.");
                navigator.getBattery().then(readBattery);
            
            }else{
                SepiaFW.debug.err("BatteryStatus is NOT supported!");
            }
        }else{
            //reset
            batteryStatusDeactivate();
        }
    }
    function batteryStatusListen(){
        //battery.addEventListener('chargingchange', readBattery);
        //battery.addEventListener("levelchange", readBattery);
        battery.onchargingchange = function(){
            readBattery(this);
        }
        battery.onlevelchange = function(){
            readBattery(this);
        }
        SepiaFW.debug.log("BatteryStatus - listening to plug and change events.");
    }
    function batteryStatusDeactivate(){
        AlwaysOn.batteryLevel = undefined;
        AlwaysOn.batteryPercentage = undefined;
        AlwaysOn.batteryPlugStatus = undefined;
        //battery.removeEventListener('chargingchange', readBattery);
        //battery.removeEventListener("levelchange", readBattery);
        battery.onchargingchange = null;
        battery.onlevelchange = null;
        battery = undefined;
        SepiaFW.debug.log("BatteryStatus - not listening to events.");
    }

    var isFreshBatteryRead = true;
    function readBattery(batt) {
        if (battery == undefined){
            battery = batt;
            batteryStatusListen();
        }
        if (!batt.level && isFreshBatteryRead){
            //This is an iOS error. Only way to fix it seems to be a reset :-/
            isFreshBatteryRead = false;
            batteryStatusDeactivate();
            navigator.getBattery().then(readBattery);
            return;
        }
    
        var previousLevel = AlwaysOn.batteryLevel;
        AlwaysOn.batteryLevel = batt.level;
        AlwaysOn.batteryPercentage = Math.round(batt.level * 100) + '%';
        if (previousLevel != AlwaysOn.batteryLevel){
            fireLevelChangeEvent();
        }
        
        var previousPlugStatus = AlwaysOn.batteryPlugStatus;
        AlwaysOn.batteryPlugStatus = batt.charging;
        if (AlwaysOn.batteryPlugStatus === true && previousPlugStatus === false){
            firePlugInEvent();
        }
    }

    function firePlugInEvent(){
        SepiaFW.debug.info("BatteryStatus - device plugged in.");
        if (!AlwaysOn.isOpen && AlwaysOn.autoLoadOnPowerPlug){
            AlwaysOn.start();
        }
    }

    function fireLevelChangeEvent(){
        //SepiaFW.debug.info("BatteryStatus - device level changed to: " + AlwaysOn.batteryPercentage);
    }

    return AlwaysOn;
}