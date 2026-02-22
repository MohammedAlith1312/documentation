---
title: React
slug: /react
content: |-
  ## Learn React

  *   React is a JavaScript library for building user interfaces.
      
  *   React is used to build single-page applications.
      
  *   React allows us to create reusable UI components.
      
      ```
      import { createRoot } from 'react-dom/client';
      
      function Hello() {
        return (
          <h1>Hello World!</h1>
        );
      }
      
      createRoot(document.getElementById('root')).render(
        <Hello />
      );
      ```
---
