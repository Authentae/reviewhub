// Accessibility testing utilities for ReviewHub
// Automated checks for WCAG compliance, color contrast, keyboard navigation

class AccessibilityTester {
  constructor() {
    this.violations = [];
    this.warnings = [];
    this.passes = [];
  }

  // Main audit function - runs all checks
  async runAudit(element = document) {
    this.violations = [];
    this.warnings = [];
    this.passes = [];

    console.log('🔍 Running ReviewHub accessibility audit...');

    // Core accessibility checks
    this.checkSemanticStructure(element);
    this.checkHeadingHierarchy(element);
    this.checkFormAccessibility(element);
    this.checkImageAccessibility(element);
    this.checkKeyboardNavigation(element);
    this.checkARIAUsage(element);
    this.checkColorContrast(element);
    this.checkFocusManagement(element);

    return this.generateReport();
  }

  // Check semantic HTML structure
  checkSemanticStructure(element) {
    const landmarks = element.querySelectorAll('header, nav, main, aside, footer, section, article');

    if (!element.querySelector('main')) {
      this.violations.push({
        type: 'structure',
        severity: 'serious',
        issue: 'Missing main landmark',
        element: 'document',
        fix: 'Add <main> element to wrap primary content'
      });
    }

    // Check for skip links
    const skipLink = element.querySelector('a[href="#main-content"], a[href*="skip"]');
    if (!skipLink) {
      this.violations.push({
        type: 'navigation',
        severity: 'moderate',
        issue: 'Missing skip to main content link',
        element: 'document',
        fix: 'Add skip link as first focusable element'
      });
    }

    // Check landmark labels
    landmarks.forEach(landmark => {
      if (['nav', 'section', 'aside'].includes(landmark.tagName.toLowerCase())) {
        const hasLabel = landmark.hasAttribute('aria-label') ||
                        landmark.hasAttribute('aria-labelledby');
        if (!hasLabel) {
          this.warnings.push({
            type: 'structure',
            severity: 'minor',
            issue: `${landmark.tagName} landmark missing accessible name`,
            element: landmark.tagName.toLowerCase(),
            fix: 'Add aria-label or aria-labelledby attribute'
          });
        }
      }
    });
  }

  // Check heading hierarchy
  checkHeadingHierarchy(element) {
    const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({
        element: h,
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim()
      }));

    if (headings.length === 0) {
      this.violations.push({
        type: 'structure',
        severity: 'serious',
        issue: 'No headings found',
        fix: 'Add semantic headings to structure content'
      });
      return;
    }

    // Check for h1
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count === 0) {
      this.violations.push({
        type: 'structure',
        severity: 'serious',
        issue: 'Missing h1 element',
        fix: 'Add exactly one h1 element as page title'
      });
    } else if (h1Count > 1) {
      this.violations.push({
        type: 'structure',
        severity: 'moderate',
        issue: `Multiple h1 elements found (${h1Count})`,
        fix: 'Use only one h1 per page'
      });
    }

    // Check heading sequence
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      if (current.level > previous.level + 1) {
        this.violations.push({
          type: 'structure',
          severity: 'moderate',
          issue: `Heading level skipped: h${previous.level} to h${current.level}`,
          element: current.element.tagName.toLowerCase(),
          fix: `Use h${previous.level + 1} instead of h${current.level}`
        });
      }

      // Check for empty headings
      if (!current.text) {
        this.violations.push({
          type: 'content',
          severity: 'serious',
          issue: 'Empty heading element',
          element: current.element.tagName.toLowerCase(),
          fix: 'Provide descriptive heading text'
        });
      }
    }
  }

  // Check form accessibility
  checkFormAccessibility(element) {
    const inputs = element.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
      const id = input.id;
      const hasLabel = input.hasAttribute('aria-label') ||
                      input.hasAttribute('aria-labelledby') ||
                      element.querySelector(`label[for="${id}"]`) ||
                      input.closest('label');

      if (!hasLabel) {
        this.violations.push({
          type: 'forms',
          severity: 'serious',
          issue: 'Form field missing accessible name',
          element: `${input.tagName.toLowerCase()}[type="${input.type || 'text'}"]`,
          fix: 'Add label element or aria-label attribute'
        });
      }

      // Check required fields
      if (input.required || input.hasAttribute('aria-required')) {
        const hasRequiredIndicator = input.hasAttribute('aria-required') ||
          input.parentElement.textContent.includes('*') ||
          input.parentElement.querySelector('[aria-label*="required"]');

        if (!hasRequiredIndicator) {
          this.warnings.push({
            type: 'forms',
            severity: 'minor',
            issue: 'Required field not clearly marked',
            element: input.tagName.toLowerCase(),
            fix: 'Add visual and programmatic required indicator'
          });
        }
      }

      // Check error messaging
      if (input.getAttribute('aria-invalid') === 'true') {
        const hasErrorMessage = input.hasAttribute('aria-describedby');
        if (!hasErrorMessage) {
          this.violations.push({
            type: 'forms',
            severity: 'serious',
            issue: 'Invalid field missing error message',
            element: input.tagName.toLowerCase(),
            fix: 'Add aria-describedby pointing to error message'
          });
        }
      }
    });
  }

  // Check image accessibility
  checkImageAccessibility(element) {
    const images = element.querySelectorAll('img');

    images.forEach(img => {
      const alt = img.getAttribute('alt');
      const hasAria = img.hasAttribute('aria-label') ||
                     img.hasAttribute('aria-labelledby') ||
                     img.hasAttribute('aria-hidden');

      if (!hasAria && alt === null) {
        this.violations.push({
          type: 'images',
          severity: 'serious',
          issue: 'Image missing alt text',
          element: 'img',
          src: img.src.split('/').pop(),
          fix: 'Add descriptive alt attribute or aria-hidden="true" for decorative images'
        });
      }

      // Check for meaningful alt text
      if (alt && (alt.toLowerCase().includes('image') || alt.toLowerCase().includes('photo'))) {
        this.warnings.push({
          type: 'images',
          severity: 'minor',
          issue: 'Generic alt text detected',
          element: 'img',
          fix: 'Use more descriptive alt text'
        });
      }
    });

    // Check SVG accessibility
    const svgs = element.querySelectorAll('svg:not([aria-hidden="true"])');
    svgs.forEach(svg => {
      const hasTitle = svg.querySelector('title');
      const hasAriaLabel = svg.hasAttribute('aria-label') || svg.hasAttribute('aria-labelledby');

      if (!hasTitle && !hasAriaLabel) {
        this.warnings.push({
          type: 'images',
          severity: 'minor',
          issue: 'SVG missing accessible name',
          element: 'svg',
          fix: 'Add <title> element, aria-label, or aria-hidden="true"'
        });
      }
    });
  }

  // Check keyboard navigation
  checkKeyboardNavigation(element) {
    const focusableElements = element.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      this.warnings.push({
        type: 'keyboard',
        severity: 'moderate',
        issue: 'No focusable elements found',
        fix: 'Ensure interactive elements are keyboard accessible'
      });
      return;
    }

    // Check for custom interactive elements without keyboard support
    const clickableElements = element.querySelectorAll('[onclick], [role="button"]');
    clickableElements.forEach(el => {
      if (!['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        const hasTabindex = el.hasAttribute('tabindex');
        const hasKeyHandler = el.hasAttribute('onkeydown') || el.hasAttribute('onkeyup');

        if (!hasTabindex) {
          this.violations.push({
            type: 'keyboard',
            severity: 'serious',
            issue: 'Interactive element not keyboard accessible',
            element: el.tagName.toLowerCase(),
            fix: 'Add tabindex="0" and keyboard event handlers'
          });
        }
      }
    });

    // Check tab order
    const tabIndexElements = Array.from(element.querySelectorAll('[tabindex]'))
      .filter(el => el.tabIndex >= 0)
      .sort((a, b) => a.tabIndex - b.tabIndex);

    const positiveTabIndex = tabIndexElements.filter(el => el.tabIndex > 0);
    if (positiveTabIndex.length > 0) {
      this.warnings.push({
        type: 'keyboard',
        severity: 'moderate',
        issue: 'Positive tabindex values found',
        count: positiveTabIndex.length,
        fix: 'Use tabindex="0" or rely on natural DOM order'
      });
    }
  }

  // Check ARIA usage
  checkARIAUsage(element) {
    // Check for invalid ARIA attributes
    const ariaAttributes = [
      'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-expanded',
      'aria-hidden', 'aria-live', 'aria-atomic', 'aria-relevant'
    ];

    element.querySelectorAll('*').forEach(el => {
      // Check for empty aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel === '') {
        this.violations.push({
          type: 'aria',
          severity: 'moderate',
          issue: 'Empty aria-label attribute',
          element: el.tagName.toLowerCase(),
          fix: 'Provide descriptive aria-label or remove attribute'
        });
      }

      // Check aria-labelledby references
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const referencedElement = element.querySelector(`#${labelledBy}`);
        if (!referencedElement) {
          this.violations.push({
            type: 'aria',
            severity: 'serious',
            issue: 'aria-labelledby references non-existent element',
            element: el.tagName.toLowerCase(),
            fix: `Ensure element with id="${labelledBy}" exists`
          });
        }
      }

      // Check for redundant role attributes
      const role = el.getAttribute('role');
      const implicitRole = this.getImplicitRole(el);
      if (role && role === implicitRole) {
        this.warnings.push({
          type: 'aria',
          severity: 'minor',
          issue: `Redundant role="${role}" on ${el.tagName.toLowerCase()}`,
          element: el.tagName.toLowerCase(),
          fix: 'Remove redundant role attribute'
        });
      }
    });

    // Check live regions
    const liveRegions = element.querySelectorAll('[aria-live]');
    liveRegions.forEach(region => {
      if (!region.hasAttribute('aria-atomic')) {
        this.warnings.push({
          type: 'aria',
          severity: 'minor',
          issue: 'Live region missing aria-atomic',
          element: region.tagName.toLowerCase(),
          fix: 'Add aria-atomic="true" or aria-atomic="false"'
        });
      }
    });
  }

  // Check color contrast (simplified)
  checkColorContrast(element) {
    // This is a basic check - full contrast testing would require more complex analysis
    const textElements = element.querySelectorAll('p, span, div, a, button, h1, h2, h3, h4, h5, h6');

    textElements.forEach(el => {
      const computedStyle = window.getComputedStyle(el);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;

      // Flag potential contrast issues (basic heuristic)
      if (color && backgroundColor) {
        if (this.isPotentialContrastIssue(color, backgroundColor)) {
          this.warnings.push({
            type: 'contrast',
            severity: 'moderate',
            issue: 'Potential color contrast issue detected',
            element: el.tagName.toLowerCase(),
            colors: { foreground: color, background: backgroundColor },
            fix: 'Test color contrast manually - aim for 4.5:1 ratio minimum'
          });
        }
      }
    });
  }

  // Check focus management
  checkFocusManagement(element) {
    // Check for visible focus indicators
    const focusableElements = element.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // Note: This is a static check - dynamic focus testing would need user interaction
    focusableElements.forEach(el => {
      const computedStyle = window.getComputedStyle(el);
      const outline = computedStyle.outline;
      const outlineStyle = computedStyle.outlineStyle;

      if (outline === 'none' || outlineStyle === 'none') {
        this.warnings.push({
          type: 'focus',
          severity: 'moderate',
          issue: 'Element may have suppressed focus indicator',
          element: el.tagName.toLowerCase(),
          fix: 'Ensure custom focus styles are provided when outline is removed'
        });
      }
    });
  }

  // Utility methods
  getImplicitRole(element) {
    const roleMap = {
      'button': 'button',
      'a': element.hasAttribute('href') ? 'link' : null,
      'input': {
        'button': 'button',
        'submit': 'button',
        'reset': 'button',
        'checkbox': 'checkbox',
        'radio': 'radio'
      }[element.type] || 'textbox',
      'select': 'combobox',
      'textarea': 'textbox',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'aside': 'complementary',
      'header': 'banner',
      'footer': 'contentinfo'
    };

    return roleMap[element.tagName.toLowerCase()] || null;
  }

  isPotentialContrastIssue(foreground, background) {
    // Very basic heuristic - real contrast testing needs color space calculations
    const fgLightness = this.getPerceivedLightness(foreground);
    const bgLightness = this.getPerceivedLightness(background);
    const difference = Math.abs(fgLightness - bgLightness);

    // Flag if difference seems low (this is approximate)
    return difference < 0.3;
  }

  getPerceivedLightness(colorString) {
    // Parse rgb() or similar and return rough lightness value
    const match = colorString.match(/\d+/g);
    if (match && match.length >= 3) {
      const [r, g, b] = match.map(Number);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    return 0.5; // Default middle value
  }

  // Generate accessibility report
  generateReport() {
    const total = this.violations.length + this.warnings.length;
    const score = Math.max(0, 100 - (this.violations.length * 5) - (this.warnings.length * 1));

    const report = {
      score,
      summary: {
        violations: this.violations.length,
        warnings: this.warnings.length,
        passes: this.passes.length
      },
      details: {
        violations: this.violations,
        warnings: this.warnings
      },
      recommendations: this.generateRecommendations()
    };

    console.log('✅ Accessibility audit complete');
    console.log(`📊 Score: ${score}/100`);
    console.log(`🚨 Violations: ${this.violations.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);

    return report;
  }

  generateRecommendations() {
    const recs = [];

    // Priority recommendations based on violation types
    const violationTypes = this.violations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {});

    if (violationTypes.structure) {
      recs.push({
        priority: 'high',
        category: 'Structure',
        action: 'Fix HTML semantic structure and heading hierarchy',
        impact: 'Critical for screen reader navigation'
      });
    }

    if (violationTypes.forms) {
      recs.push({
        priority: 'high',
        category: 'Forms',
        action: 'Add proper labels and error handling to form fields',
        impact: 'Essential for form completion by assistive technology users'
      });
    }

    if (violationTypes.keyboard) {
      recs.push({
        priority: 'high',
        category: 'Keyboard',
        action: 'Ensure all interactive elements are keyboard accessible',
        impact: 'Required for users who cannot use a mouse'
      });
    }

    if (violationTypes.images) {
      recs.push({
        priority: 'medium',
        category: 'Images',
        action: 'Add meaningful alternative text for all images',
        impact: 'Provides content access for users with visual impairments'
      });
    }

    return recs;
  }
}

// Export for use in tests or manual auditing
export { AccessibilityTester };

// Auto-run in development
if (process.env.NODE_ENV === 'development') {
  window.runA11yAudit = async () => {
    const tester = new AccessibilityTester();
    const report = await tester.runAudit();
    console.table(report.details.violations);
    return report;
  };
}