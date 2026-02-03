import React, { useEffect, useRef } from 'react';
import { ArrowRight, Brain } from 'lucide-react';
import './AboutPage.css';

const AboutPage = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Load GSAP dynamically
    const loadGSAP = async () => {
      try {
        // Import GSAP and ScrollTrigger
        const gsap = (await import('gsap')).default;
        const ScrollTrigger = (await import('gsap/ScrollTrigger')).default;
        
        // Register ScrollTrigger plugin
        gsap.registerPlugin(ScrollTrigger);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const frameCount = 179;

        // Since we don't have the actual images, we'll create a canvas-based animation
        const currentFrame = (index) => {
          // Use the actual images from src/optimized_blender_imgs folder
          return `/optimized_blender_imgs/${(index + 1).toString()}.webp`;
        };

        const images = [];
        let ball = { frame: 0 };

        // Load actual images from src/optimized_blender_imgs folder
        for (let i = 0; i < frameCount; i++) {
          const img = new Image();
          img.src = currentFrame(i);
          
          // Add error handling
          img.onerror = () => {
            console.warn(`Failed to load image: ${currentFrame(i)}`);
          };
          
          img.onload = () => {
            console.log(`Loaded image: ${currentFrame(i)}`);
          };
          
          images.push(img);
        }

        // Set canvas size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // GSAP animation for frame progression
        gsap.to(ball, {
          frame: frameCount - 1,
          snap: "frame",
          ease: "none",
          scrollTrigger: {
            scrub: 0.5,
            pin: ".canvas-container",
            end: "500%",
          },
          onUpdate: () => render(context, canvas, images, ball),
        });

        // Headline animation
        gsap.fromTo(
          ".headline",
          {
            opacity: 0,
          },
          {
            opacity: 1,
            scrollTrigger: {
              scrub: 1,
              start: "60%",
              end: "80%",
            }
          }
        );

        // Side features animations
        gsap.utils.toArray(".feature-card").forEach((card) => {
          const scrollPosition = parseFloat(card.dataset.scroll);
          
          gsap.fromTo(
            card,
            {
              opacity: 0,
              x: card.parentElement.classList.contains('left') ? -100 : 100,
            },
            {
              opacity: 1,
              x: 0,
              scrollTrigger: {
                scrub: 1,
                start: `${scrollPosition * 100}%`,
                end: `${(scrollPosition + 0.1) * 100}%`,
              }
            }
          );
        });

        // Initial render
        images[0].onload = () => render(context, canvas, images, ball);

        // Handle resize
        const handleResize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          render(context, canvas, images, ball);
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        };

      } catch (error) {
        console.error('Error loading GSAP:', error);
      }
    };

    loadGSAP();
  }, []);

  const render = (context, canvas, images, ball) => {
    if (images.length === 0) return;
    
    const frameIndex = Math.floor(ball.frame);
    const img = images[frameIndex];
    
    if (!img || !img.complete || img.naturalWidth === 0) {
      // Handle broken or loading images
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw placeholder text
      context.fillStyle = '#ffffff';
      context.font = '24px Arial';
      context.textAlign = 'center';
      context.fillText(`Loading frame ${frameIndex + 1}...`, canvas.width / 2, canvas.height / 2);
      return;
    }
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scaling to fit canvas
    const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const x = (canvas.width - img.naturalWidth * scale) / 2;
    const y = (canvas.height - img.naturalHeight * scale) / 2;
    
    // Draw image
    context.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
  };

  const handleGetStarted = () => {
    window.location.href = '/app';
  };

  return (
    <div className="gsap-about-container">
      {/* Navigation */}
      <nav className="gsap-nav">
        <div className="nav-content">
          <div className="nav-logo">
            <Brain className="logo-icon" />
            <span>ScreenAI</span>
          </div>
          <div className="nav-actions">
            <a href="/" className="nav-btn secondary">← Back</a>
            <button className="nav-btn primary" onClick={handleGetStarted}>
              Try Now
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Canvas Container with Side Features */}
      <div className="canvas-container">
        <canvas ref={canvasRef} className="canvas"></canvas>
        
        {/* Left Side Features */}
        <div className="side-features left">
          <div className="feature-card" data-scroll="0.1">
            <h3>Smart Conversations</h3>
            <p>Powered by advanced LLaMA AI</p>
          </div>
          <div className="feature-card" data-scroll="0.3">
            <h3>Voice Input</h3>
            <p>Natural voice recognition</p>
          </div>
          <div className="feature-card" data-scroll="0.5">
            <h3>Smart Recommendations</h3>
            <p>Context-aware suggestions</p>
          </div>
        </div>
        
        {/* Right Side Features */}
        <div className="side-features right">
          <div className="feature-card" data-scroll="0.2">
            <h3>Screen Analysis</h3>
            <p>OCR-powered understanding</p>
          </div>
          <div className="feature-card" data-scroll="0.4">
            <h3>Instant Responses</h3>
            <p>Lightning-fast streaming</p>
          </div>
          <div className="feature-card" data-scroll="0.6">
            <h3>Privacy First</h3>
            <p>Your data stays secure</p>
          </div>
        </div>
        
        {/* Headline */}
        <div className="headline">
          <h1>ScreenAI Features</h1>
          <p>Scroll to explore our AI-powered capabilities</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
