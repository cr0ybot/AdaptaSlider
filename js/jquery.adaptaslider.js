/*
 * AdaptaSlider v1.0.1
 * http://github.com/cr0ybot/adaptaslider
 *
 * Made by Cory Hughart
 * MIT license: http://opensource.org/licenses/MIT
 *
 * Built with jQuery 1.11.0
 */

;(function($, window, document, undefined) {
	"use strict";

	// Defaults
	var pluginName = 'adaptaSlider',
		defaults = {

			// Slideshow features
			mode                : 'slide',      // set to 'slide', 'fade', or 'custom' (only first letter checked, will default to slide) (req: animate)
			easing              : 'swing',      // 'linear' or 'swing', can include easing plugin for more options: http://gsgd.co.uk/sandbox/jquery/easing/ (req: animate)
			startSlide          : 0,            // zero-indexed slide to start on
			animate             : true,         // if false, slider will not control transitions; you can then create CSS transitions based on the 'current', 'prev', & 'next' classes that are applied to the slides
			autoPlay            : true,         // if false, slider must be manually controlled
			pauseOnHover        : true,         // if false, slider will not pause on hover (req: autoPlay)
			loop                : true,         // if false, slider will stop on last slide (req: autoPlay)

			// Custom class names (set to empty string to not add class)
			sliderClass         : 'slider',     // Class applied to slider
			currentSlideClass   : 'current',    // Class applied to current slide
			prevSlideClass      : 'prev',       // Class applied to previous slide
			nextSlideClass      : 'next',       // Class applied to next slide
			activeSelectClass   : 'active',     // Class applied to active select button

			// Timing
			pauseTime           : 7000,         // milliseconds to pause on each slide (req: autoPlay)
			transitionTime      : 600,          // milliseconds to transition between slides (req: autoPlay)
			resumeTime          : 12000,        // milliseconds to resume autoplay after user interaction (req: autoPlay)

			// Controls
			useControls         : true,         // if false, controls will not be set up; you can still manually access controls with your own script
			prevButton          : '',           // jQuery selector string for prev button; required for prevHTML
			nextButton          : '',           // jQuery selector string for next button; required for nextHTML
			selectButton        : '',           // jQuery selector string for select button(s); required for selectHTML

			// Button creation
			prevHTML            : '',           // this string (or function returning an HTML string) will be placed inside prevButton (req: useControls, prevButton)
			nextHTML            : '',           // this string (or function returning an HTML string) will be placed inside nextButton (req: useControls,nextButton)
			selectHTML          : '',           // this string (or function(index) returning an HTML string) will be placed inside selectHTML (multiplied by number of slides) (req: useControls, selectHTML)
			selectHTMLNumbers   : false,        // Whether numbers should be inserted into the selectHTML (incompatible with selectHTML containing function)

			// Callback functions
			onLoaded            : function(){},                     // Callback triggered after plugin loads
			onWillSlide         : function(fromSlide, toSlide){},   // Callback triggered before slider slides, supplies 'fromSlide' & toSide'
			onDidSlide          : function(fromSlide, toSlide){},   // Callback triggered after slider slides, supplies 'fromSlide' & toSide'

			// Custom
			customSetup         : function(slider){},               // (req: mode=custom)
			customTransition    : function(slider, fromSlide, toSlide, time, easing, callback){
				setTimeout(callback, time, this);
			}, // You MUST invoke the callback! (req: mode=custom)

			// Debug
			verbose             : false         // If true, log to JavaScript console; leave false for production
		};

	function AdaptaSlider(element, options) {

		// Setup self & settings shortcut vars
		var self = this, s;

		self.slider = element;
		self.$slider = $(element);
		// Shortcut to settings object 's'
		self.settings = s = $.extend({}, defaults, options);
		self.currentSlide = 0;
		self.playing = false;
		self.animating = false;
		self.timer = 0;

		// Debug output
		var debug = {
			log: function() {
				if (s.verbose) console.log.apply(console, arguments);
			},
			warn: function() {
				if (s.verbose) console.warn.apply(console, arguments);
			},
			dir: function() {
				if (s.verbose) console.dir.apply(console, arguments);
			},
			group: function() {
				if (s.verbose) console.group.apply(console, arguments);
			},
			groupEnd: function() {
				if (s.verbose) console.groupEnd.apply(console, arguments);
			}
		}

		debug.log('as: %s initiated', pluginName);

		// Debug
		debug.log('as: slider object:');
		debug.dir(self.slider);
		debug.log('as: settings:');
		debug.dir(s);

		// Add reverse reference to the DOM object
		// This prevent multiple instances, but also
		// provides a way to access the plugin via
		// element.data('adaptaSlider').publicMethod() or
		// element.data('adaptaSlider').settings.propertyName
		self.$slider.data(pluginName, self);

		// Object containing all animations
		self.animate = {
			// Fade transition
			fade: function(fromSlide, toSlide, time, easing, callback) {
				var f = self.$slides.eq(fromSlide);
				var t = self.$slides.eq(toSlide);
				t.css('visibility', 'visible');
				f.fadeTo(time, 0, easing, function() {
					f.css('visibility', 'hidden');
				});
				t.fadeTo(time, 1, easing, callback);
			},

			// Slide transition
			slide: function(fromSlide, toSlide, time, easing, callback) {
				var pos = -toSlide*100;
				debug.log('slide to position: %d%', pos);
				self.$slides.eq(0).animate({
					'margin-left': pos + '%'
				}, time, easing, callback);
			}
		}

		// Private constructor, only called from within
		var init = function() {
			debug.log('as: init()');

			// Setup slider classes
			self.$slider.addClass(s.sliderClass);
			//self.$slides.addClass('slide');

			// Setup initial state
			self.currentSlide = s.startSlide;
			self.update();

			// Trigger on loaded callback
			onLoadedCallback();

			return self;
		};

		// Public methods

		self.update = function() {
			debug.log('as: update()');

			// Find slides
			self.$slides = self.$slider.children();
			self.numSlides = self.$slides.length;

			// Do nothing if there's only one slide
			if (self.numSlides > 1) {
				// Create controls
				createControls();

				// Current slide & slide classes
				self.setCurrentSlideAndSelect(self.currentSlide);

				// Setup for animation
				animationSetup();

				// Start slider
				if(s.autoPlay){
					self.setPlaying(true);

					// Pause on hover
					if (s.pauseOnHover && s.pauseTime && s.pauseTime > 0) {
						self.$slider.hover(
							function () {
								if (self.playing) {
									debug.log('as: pausing for hover');
									//self.togglePlaying();
									self.clearTimer();
									self.$slider.addClass('paused');
								}
							},
							function () {
								if (self.playing) {
									debug.log('as: resuming after hover');
									//self.togglePlaying();
									self.setTimer();
									self.$slider.removeClass('paused');
								}
							}
						);
					}
				}
			}
		};

		// Prev
		self.prev = function() {
			debug.log('as: prev()');
			goToSlide(self.getPrevSlide());
		};

		// Next
		self.next = function() {
			debug.log('as: next()');
			goToSlide(self.getNextSlide());
		};

		// Select
		self.select = function(slide) {
			debug.log('as: select(%d)', slide);
			goToSlide(modInt(parseInt(slide), self.numSlides));
		};

		self.getPrevSlide = function() {
			debug.log('as: getPrevSlide()');
			return modInt(self.currentSlide - 1, self.numSlides);
		};

		self.getNextSlide = function() {
			debug.log('as: getNextSlide()');
			return modInt(self.currentSlide + 1, self.numSlides);
		};

		self.setCurrentSlide = function(slide) {
			debug.log('as: setCurrentSlide(%d)', slide);
			self.currentSlide = modInt(parseInt(slide), self.numSlides) || 0;
			self.$slides.removeClass(s.currentSlideClass+' '+s.prevSlideClass+' '+s.nextSlideClass);
			self.$slides.eq(self.currentSlide).addClass(s.currentSlideClass);
			self.$slides.eq(self.getPrevSlide()).addClass(s.prevSlideClass);
			self.$slides.eq(self.getNextSlide()).addClass(s.nextSlideClass);
		};

		self.setCurrentSelect = function() {
			debug.log('as: setCurrentSelect()');
			debug.group('changing active select button...');
			if (self.$selectButton) {
				debug.log('setting selectButton:' + self.currentSlide + ' to active');
				self.$selectButton.removeClass(s.activeSelectClass);
				self.$selectButton.eq(self.currentSlide).addClass(s.activeSelectClass);
			}
			else {
				debug.warn('no selectButtons found');
			}
			debug.groupEnd();
		};

		self.setCurrentSlideAndSelect = function(slide) {
			self.setCurrentSlide(slide);
			if (self.$selectButton) self.setCurrentSelect();
		};

		self.setTimer = function(time, callback) {
			var _time = time ? time : s.pauseTime;
			// default callback to self.next() if not provided
			var _callback = callback ? callback : self.next;
			debug.log('as: setTimer(%d, %s)', _time, (_callback.name ? _callback.name : '[anonymous]'));
			self.clearTimer();
			self.timer = setTimeout(function() { _callback.call(self); }, _time);
		};

		self.clearTimer = function() {
			debug.log('as: clearTimer()');
			clearTimeout(self.timer);
		};

		self.setPlaying = function(playing) {
			self.playing = playing;
			debug.log('as: playing set to %s', self.playing);
			if (self.playing) {
				self.setTimer();
			}
			else {
				self.clearTimer();
			}
		};

		self.togglePlaying = function() {
			self.setPlaying(!self.playing);
		};

		self.doneAnimating = function() {
			self.animating = false;
		};

		// Private methods

		// Customizable on load callback
		var onLoadedCallback = function() {
			debug.log('as: onLoadedCallback()');
			s.onLoaded.call(self);
		};

		// Customizable on will slide callback
		var onWillSlideCallback = function(fromSlide, toSlide) {
			debug.log('as: onWillSlideCallback(%d, %d)', fromSlide, toSlide);
			s.onWillSlide.call(self, fromSlide, toSlide);
		};

		// Customizable on did slide callback
		var onDidSlideCallback = function(fromSlide, toSlide) {
			debug.log('as: onDidSlideCallback(%d, %d)', fromSlide, toSlide);
			s.onDidSlide.call(self, fromSlide, toSlide);
		};

		// Handles creation of slider controls
		var createControls = function() {
			debug.log('as: createControls()');
			// Only create controls if wanted or needed
			if (s.useControls && self.numSlides > 1) {
				debug.group('creating controls...');
				// Setup prev button
				if (s.prevButton && $(s.prevButton).length) {
					debug.log('creating prevButton');

					self.$prevButton = $(s.prevButton);

					// If constructor is provided, append to prevButton element
					if (s.prevHTML) {
						if (typeof s.prevHTML == 'string') {
							debug.log('adding prevHTML');
							// Check for valid HTML
							if (validateHTML(s.prevHTML, 'prevHTML'))
								self.$prevButton = $(s.prevHTML).appendTo(self.$prevButton);
					   }
					   else if (typeof s.prevHTML == 'function') self.$prevButton = $(s.prevHTML.call(this)).appendTo(self.$prevButton);
					}

					// Click listener
					self.$prevButton.click(function(e) {
						e.preventDefault();
						self.prev();
					});
				}
				else {
					debug.warn('prevButton not specified');
				}

				// Setup next button
				if (s.nextButton && $(s.nextButton).length) {
					debug.log('creating nextButton');

					self.$nextButton = $(s.nextButton);

					// If constructor is provided, append to prevButton element
					if (s.nextHTML) {
						//self.$nextButton = self.$nextButton.append(s.nextHTML);
						if (typeof s.nextHTML == 'string') {
							debug.log('adding nextHTML');
							// Check for valid HTML
							if (validateHTML(s.nextHTML, 'nextHTML'))
								self.$nextButton = $(s.nextHTML).appendTo(self.$nextButton);
						}
						else if (typeof s.nextHTML == 'function')
							self.$nextButton = $(s.nextHTML.call(this)).appendTo(self.$nextButton);
					}

					// Click listener
					self.$nextButton.click(function(e){
						e.preventDefault();
						self.next();
					});
				}
				else {
					debug.warn('nextButton not specified');
				}

				// Setup select buttons
				if (s.selectButton && $(s.selectButton).length) {
					debug.log('creating selectButton');

					self.$selectButton = $(s.selectButton);

					// If constructor is provided, append to selectButton element
					if (s.selectHTML) {
						if (typeof s.selectHTML == 'string') {
							debug.log('adding selectHTML');
							// Check for valid HTML
							if (validateHTML(s.selectHTML, 'selectHTML')) {
								self.$selectButton = $(
									// Place as many buttons as slides
									//repeatString(s.selectHTML, self.numSlides)
									repeatElement(s.selectHTML, self.numSlides)
									// and append to only the first matched element
								).appendTo(self.$selectButton.eq(0));
								if (s.selectHTMLNumbers) {
									// Get type of element introduced by selectHTML, just in case there are other elements inside selectHTML
									var tagName = $(s.selectHTML).prop('tagName');
									$(s.selectButton).children(tagName).each(function(index) {
										$(this).append('<span>' + (index+1) + '</span>');
									});
								}
							}
						}
						else if (typeof s.selectHTML == 'function') {
							var selectHTMLStr = '';
							// Call the constructor for each slide, passing index
							self.$slides.each(function(i) {
								selectHTMLStr += s.selectHTML.call(this, i);
							});
							self.$selectButton = $(selectHTMLStr).appendTo(self.$selectButton);
						}
						// Error conditions
						else {
							if (typeof s.selectHTML == 'string' && s.selectHTML.charAt(0) !== '<') {
								alert('selectHTML must specify a valid HTML string');
							}
						}
					}

					self.$selectButton.each(function(i) {
						$(this).click(function(e) {
							e.preventDefault();
							self.select(i);
						});
					});
				}
				else {
					debug.warn('selectButton not specified');
				}
				debug.groupEnd();
			}
			else {
				if (s.verbose) {
					debug.group('not creating controls');
					if (self.numSlides === 0)
						debug.warn('only 1 slide, controls not created');
					else
						debug.log('useControls set to false');
					debug.groupEnd();
				}
			}
		};

		// Sets up the slides for specific mode of transition
		var animationSetup = function() {
			debug.log('as: animationSetup()');
			if (s.animate) {
				debug.group('setting up slider elements...')
				debug.log('mode = ' + s.mode);
				// Mode select
				switch (s.mode.charAt(0)) {
					case 'c': // custom
						s.customSetup.call(self, self.$slider);
						break;
					case 'f': // fade
						self.$slider.css({
							'display': 'block',
							'position': 'relative'
						}).append('<div style="clear: both"/>');
						self.$slides.css({
							'display': 'block',
							'float': 'left',
							'width': '100%',
							'margin-left': 0,
							'margin-right': '-100%',
							'opacity': 0,
							'visibility': 'hidden'
						}).eq(self.currentSlide).css({'opacity': 1, 'visibility': 'visible'});
						break;
					case 's': // slide
					default: // If input is not understood, slide is default
						self.$slider.css({
							'display': 'block',
							'position': 'relative',
							'white-space': 'nowrap',
							'font-size': 0, // removes spaces on inline elements
							'overflow': 'hidden'
						});
						self.$slides.css({
							'display': 'inline-block',
							'white-space': 'normal',
							'width': '100%',
							'font-size': '16px' // reset font size
						});
						break;
					// Room for future transition types?
				}
				debug.groupEnd();
			}
		};

		// Handles transitions between slides
		var transition = function(fromSlide, toSlide) {
			debug.log('as: transition(%d, %d)', fromSlide, toSlide);

			if (s.animate && !self.animating) {
				debug.group('animating...');
				self.animating = true;
				// Mode select
				switch (s.mode.charAt(0)) {
					case 'c': // custom
						debug.log('custom transition');
						s.customTransition.call(self, self.$slider, fromSlide, toSlide, s.transitionTime, s.easing, self.doneAnimating);
						break;
					case 'f': // fade
						debug.log('animation will fade');
						self.animate.fade(fromSlide, toSlide, s.transitionTime, s.easing, self.doneAnimating);
						break;
					case 's': // slide
					default: // If input is not understood, slide is default
						debug.log('animation will slide');
						self.animate.slide(fromSlide, toSlide, s.transitionTime, s.easing, self.doneAnimating);
						break;
					// Room for future transition types?
				}
				debug.groupEnd();
			}
			else if (self.animating) {
				debug.warn('as: animation is already ocurring!');
			}
		};

		// Handles changing slide classes, initiates transition, and callbacks
		var goToSlide = function(slide) {
			debug.log('as: goToSlide(%d)', slide);
			// Only go if not currently animating
			if (!self.animating) {
				var fromSlide = self.currentSlide,
					toSlide = slide;

				debug.group('transitioning slides...');

				// Only go if slide requested is different than the current one
				if (toSlide !== fromSlide) {

					debug.log('going from %d to %d', fromSlide, toSlide);

					// Trigger on will slide callback
					onWillSlideCallback(fromSlide, toSlide);

					// transition
					transition(fromSlide, toSlide);

					// Set classes on target slide, prev, next, & update select buttons
					self.setCurrentSlideAndSelect(toSlide);

					// autoPlay
					if (s.autoPlay && self.playing) {
						self.setTimer();
					}

					// Trigger on did slide callback
					onDidSlideCallback(fromSlide, toSlide);
				}
				else {
					debug.warn('already on slide %d', toSlide);
				}

				debug.groupEnd();
			}
			else {
				debug.warn('as: cannot go while animation is ocurring!')
			}
		};

		// Initialize
		return init();

	};

	// Add plugin to jQuery
	$.fn[pluginName] = function(options) {
		if (options && options.hasOwnProperty('verbose') && options.verbose) console.log('as: %s plugin invoked with -verbose', pluginName);

		return this.each(function() {
			var ss = $(this).data(pluginName);

			// Initialize while preventing multiples
			if (!ss)
				(new AdaptaSlider(this, options));
			else
				ss.update();
		});

		//return this;
	};

	// Global utility functions

	// Return integer modulo
	function modInt(num, denom) {
		//if(num > 0) return Math.floor(num % denom);
		//else return Math.ceil(num % denom);
		return ((num % denom) + denom) % denom;
	}

	// Return repeated string
	function repeatString(str, count) {
		return new Array(count+1).join(str);
	}

	// Return repeated jQuery element
	function repeatElement(str, count) {
		var $el;
		// This method avoids nesting if string is an unclosed HTML tag
		for (var i = 0; i < count; i++) {
			if (!$el) $el = $(str);
			else $el = $el.add(' '+str);
		}
		return $el;
	}

	// Validate HTML string
	function validateHTML(str, name) {
		var valid = false;
		try { $(str)[0]; valid = true; }
		catch (e) {
			alert('Your "'+name+'" HTML string did not pass validation:\n' + str + '\n' + e);
			console.error('as: Your "%s" HTML string did not pass validation: "%s"', name, str);
		}
		return valid;
	}

})(jQuery);
