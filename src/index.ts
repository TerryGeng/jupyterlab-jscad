// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Widget } from '@lumino/widgets';

import { Message } from '@lumino/messaging';

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { cameras, entitiesFromSolids, controls, prepareRender, drawCommands } from '@jscad/regl-renderer';

import '../style/index.css';

/**
 * The CSS class to add to the GeoJSON Widget.
 */
const CSS_CLASS = 'jp-RenderedJSCAD';

/**
 * The MIME type for JSCAD.
 */
export const MIME_TYPE = 'application/jscad-geom';


export class RenderedJSCAD extends Widget implements IRenderMime.IRenderer {
    /**
     * Create a new widget for rendering GeoJSON.
     */

    constructor(options: IRenderMime.IRendererOptions) {
        super();
        this.addClass(CSS_CLASS);
        this._mimeType = options.mimeType;

        this._camera = Object.assign({}, cameras.perspective.defaults);
        this._updateReqId = null;
        this._render = null;
        this._renderOptions = null;
        this._updateView = true;
        this._controls = Object.assign({}, controls.orbit.defaults);

        this._container = document.createElement("div");
        this.node.appendChild(this._container);

        this._panDelta = [0, 0];
        this._rotateDelta = [0, 0];
        this._zoomDelta = 0;

        this._mousePointerDown = false;
        this._mouseLastX = 0;
        this._mouseLastY = 0;
    }

    /**
     * Dispose of the widget.
     */
    dispose(): void {
        if (this._updateReqId) {
            window.cancelAnimationFrame(this._updateReqId);
        }

        window.localStorage.setItem('jupyter-jscad-camera-position', this._camera.position);
        window.localStorage.setItem('jupyter-jscad-camera-target', this._camera.target);

        this._camera = null;
        super.dispose();
    }

    protected prepareGestures(): void {
        // rotate & pan
        this._container.onpointermove = (ev) => {
            if (!this._mousePointerDown) return;

            const x = this._mouseLastX - ev.pageX;
            const y = ev.pageY - this._mouseLastY;

            if (ev.shiftKey) {
                this._panDelta[0] += x;
                this._panDelta[1] += y;
            } else {
                this._rotateDelta[0] -= x;
                this._rotateDelta[1] -= y;
            }

            this._mouseLastX = ev.pageX;
            this._mouseLastY = ev.pageY;

            ev.preventDefault();
        };

        this._container.onpointerdown = (ev) => {
            this._mousePointerDown = true;
            this._mouseLastX = ev.pageX;
            this._mouseLastY = ev.pageY;

            this._container.setPointerCapture(ev.pointerId);
        };

        this._container.onpointerup = (ev) => {
            this._mousePointerDown = false;
            this._container.releasePointerCapture(ev.pointerId);
        };

        // zoom
        this._container.onwheel = (ev) => {
            this._zoomDelta += ev.deltaY;

            ev.preventDefault();
        };
    }

    doRotatePanZoom(): void {
        const rotateSpeed = 0.002;
        const panSpeed = 1;
        const zoomSpeed = 0.08;

        if (this._rotateDelta[0] || this._rotateDelta[1]) {
            const updated = controls.orbit.rotate({ controls: this._controls, camera: this._camera, speed: rotateSpeed }, this._rotateDelta);
            this._controls = { ...this._controls, ...updated.controls };
            this._updateView = true;
            this._rotateDelta = [0, 0];
        }

        if (this._panDelta[0] || this._panDelta[1]) {
            const updated = controls.orbit.pan({ controls:this._controls, camera:this._camera, speed: panSpeed }, this._panDelta);
            this._controls = { ...this._controls, ...updated.controls };
            this._panDelta = [0, 0];
            this._camera.position = updated.camera.position;
            this._camera.target = updated.camera.target;
            this._updateView = true;
        }

        if (this._zoomDelta) {
            const updated = controls.orbit.zoom({ controls:this._controls, camera:this._camera, speed: zoomSpeed }, this._zoomDelta);
            this._controls = { ...this._controls, ...updated.controls };
            this._zoomDelta = 0;
            this._updateView = true;
        }
    }

    protected clearGestures(): void {
        this._container.onpointermove = null;
        this._container.onpointerdown = null;
        this._container.onpointerup = null;
        this._container.onwheel = null;
    }
    
    /**
     * Render JSCAD models into this widget's node.
     */
    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        const data = model.data[this._mimeType] as any;

        if (data.preserveCamera) {
            const savedCameraPosition = window.localStorage.getItem('jupyter-jscad-camera-position') || null;
            const savedCameraTarget = window.localStorage.getItem('jupyter-jscad-camera-target') || null;

            if (savedCameraPosition != null) {
                this._camera.position = savedCameraPosition.split(",").map(function (x: string) { return parseInt(x, 10); });
            }
            if (savedCameraTarget != null) {
                this._camera.target = savedCameraTarget.split(",").map(function (x: string) { return parseInt(x, 10); });
            }
        }

        this._minHeight = data.minHeight || 300;
        this._forceHeight = data.height || null;

        if (this._updateReqId) {
            window.cancelAnimationFrame(this._updateReqId);
        }

        return new Promise<void>((resolve, reject) => {
            this._entities = entitiesFromSolids({}, data.geom);

            this.prepareGestures();

            const gridOptions = {
                visuals: {
                    drawCmd: 'drawGrid',
                    show: true,
                    color: [0, 0, 0, 0.6],
                    subColor: [0, 0, 1, 0.3],
                    fadeOut: false,
                    transparent: true
                },
                size: [500, 500],
                ticks: [10, 1]
            }
            const axisOptions = {
                visuals: {
                    drawCmd: 'drawAxis',
                    show: true
                },
                alwaysVisible: false,
            }

            this._renderOptions = {
                glOptions: { container: this._container },
                camera: this._camera,
                drawCommands: {
                    drawAxis: drawCommands.drawAxis,
                    drawGrid: drawCommands.drawGrid,
                    drawLines: drawCommands.drawLines,
                    drawMesh: drawCommands.drawMesh
                },
                entities: [
                    gridOptions,
                    axisOptions,
                    ...this._entities
                ]
            };

            cameras.perspective.setProjection(this._camera, this._camera, { width: 300, height: 300 });

            const updateAndRender = (): void => {
                this.doRotatePanZoom();

                if (this._updateView) {
                    // prepare the renderer
                    if (this._render == null) {
                        this._render = prepareRender({
                            glOptions: { container: this._container },
                        })
                    }

                    const updates = controls.orbit.update({ controls: this._controls, camera: this._camera });
                    this._controls = { ...this._controls, ...updates.controls };
                    this._updateView = this._controls.changed; // for elasticity in rotate / zoom

                    this._camera.position = updates.camera.position;
                    cameras.perspective.update(this._camera, this._camera);

                    this._render(this._renderOptions);
                }

                this._updateReqId = window.requestAnimationFrame(updateAndRender);
            }

            this._updateView = true;
            this._updateReqId = window.requestAnimationFrame(updateAndRender);

            this.update();
            resolve();
        });
    }

    protected setCameraPerspective(): void {
        const pixelRatio = window.devicePixelRatio || 1;
        const bounds = this.node.getBoundingClientRect();

        const width = (bounds.right - bounds.left) * pixelRatio;
        const height = this._forceHeight || Math.max((bounds.bottom - bounds.top) * pixelRatio, this._minHeight);

        this._container.style.height = height.toString() + "px";
        this._container.style.width = width.toString() + "px";
    
        cameras.perspective.setProjection(this._camera, this._camera, { width, height });

        this._updateView = true;
    }

    /**
     * A message handler invoked on an `'after-attach'` message.
     */
    protected onAfterAttach(msg: Message): void {
        this.update();
    }

    /**
     * A message handler invoked on an `'after-show'` message.
     */
    protected onAfterShow(msg: Message): void {
        this.update();
    }

    /**
     * A message handler invoked on a `'resize'` message.
     */
    protected onResize(msg: Widget.ResizeMessage): void {
        this.setCameraPerspective();
        this.update();
    }

    /**
     * A message handler invoked on an `'update-request'` message.
     */
    protected onUpdateRequest(msg: Message): void {
        this.setCameraPerspective();
        this.update();
    }

    private _mimeType: string;

    private _camera: any;
    private _updateReqId: number;
    private _render: any;
    private _renderOptions: any;
    private _controls: any;
    private _entities: any[];
    private _updateView: boolean;
    private _panDelta: number[];
    private _rotateDelta: number[];
    private _zoomDelta: number;
    private _mousePointerDown: boolean;
    private _mouseLastX: number;
    private _mouseLastY: number;
    private _container: HTMLElement;
    private _minHeight: number;
    private _forceHeight: number;
};

/**
 * A mime renderer factory for GeoJSON data.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
    safe: true,
    mimeTypes: [MIME_TYPE],
    createRenderer: (options) => new RenderedJSCAD(options)
};

const extensions: IRenderMime.IExtension | IRenderMime.IExtension[] = [
    {
        id: '@jupyterlab/jscad-extension:factory',
        rendererFactory,
        rank: 0,
        dataType: 'json',
    },
];

export default extensions;
