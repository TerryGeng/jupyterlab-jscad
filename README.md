# jupyterlab-jscad

A JupyterLab extension for rendering JSCAD geometries. Designed to work with [ijavascript](https://github.com/n-riesco/ijavascript) kernel.

![screenshot](screenshot.jpg)

## Requirements

- JupyterLab >= 3.0

## Install

```bash
pip install jupyterlab-jscad
```

## Usage

jupyterlab-jscad runs as a MIME renderer extension of JupyterLab.

To render JSCAD geometries in IJavascript:

```javascript
let jscad = require("@jscad/modeling") // @jscad/modeling has been installed globally, with NODE_PATH environment variable set

let { cube } = jscad.primitives

$$.mime({
    "application/jscad-geom": {
        geom: cube({ size: 10 }), // <--- feed output geometries here
        preserveCamera: true,     // <--- preserve camera position across executions
        minHeight: 300,           // <--- set minimum height of the canvas to 300
        // height: 300            // <--- force the height of canvas to be 300
    }
});
```

## Contributing

### Development install

```bash
jlpm install
jlpm run build
jupyter labextension install . --no-build
```

See tutorials at [https://jupyterlab.readthedocs.io/en/stable/extension/extension_tutorial.html](https://jupyterlab.readthedocs.io/en/stable/extension/extension_tutorial.html)
and [https://github.com/jupyterlab/jupyterlab-mp4/blob/master/tutorial.md](https://github.com/jupyterlab/jupyterlab-mp4/blob/master/tutorial.md
