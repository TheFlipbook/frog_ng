import { Component, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';

import { Observable, Subscription } from 'rxjs';

import { IItem, CVideo } from '../shared/models';
import { Point, Matrix } from '../shared/euclid';
import { SelectionService } from '../shared/selection.service';
import {ImageAtlas, kMaxCanvasSize} from "./image-atlas";


@Component({
    selector: 'frog-video',
    templateUrl: './html/video.html',
    styles: [
        'video, canvas { width: 100%; height: 100%; cursor:ew-resize; }',
        '#video_player { margin: 0 auto; }',
        '.info { font-family: Courier; background-color: #000; }',
        '.row { margin: 0; padding: 0; }',
        'i { vertical-align: middle; }',
    ]
})
export class VideoComponent implements OnDestroy {
    @ViewChild('vid') vid: ElementRef;
    @ViewChild('viewport') viewport: ElementRef;

    private origin: Point = new Point();
    private main: Matrix = Matrix.Identity();
    private wasPaused: boolean;
    private alive: boolean = true;
    private isMouseDown: boolean = false;
    private element: HTMLVideoElement;
    private atlas: ImageAtlas;
    private vctx: CanvasRenderingContext2D;
    private infoPadding: number = 28;
    private subs: Subscription[];
    private currentframe: number;
    public xform: Matrix = Matrix.Identity();
    public frame: number;
    public frameCount: number;
    public margin: number;
    public object: CVideo;
    public width: number;
    public height: number;
    public loadedframe: number;
    public loadingframes: boolean;
    public cangetframes: boolean;
    public frameview: boolean;

    constructor(viewport: ElementRef, private service: SelectionService) {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.object = new CVideo();
        this.element = null;
        this.wasPaused = false;
        this.frame = 0;
        this.subs = [];
        this.frameview = false;
        this.currentframe = 0;
    }
    ngAfterViewInit() {
        this.element = this.vid.nativeElement;
        this.vctx = this.viewport.nativeElement.getContext('2d');
        let sub = Observable.fromEvent(<any>this.element, 'timeupdate').subscribe(event => {
            this.frame = Math.floor(this.object.framerate * this.element.currentTime);
        });
        this.subs.push(sub);
        sub = Observable.fromEvent(<any>this.element, 'canplay').subscribe(event => {
            this.frameCount = this.object.framerate * this.element.duration
            if (this.object.width * this.object.height * this.frameCount <= Math.pow(kMaxCanvasSize, 2)) {
                setTimeout(() => this.cangetframes = true, 0);
            }
        });
        this.subs.push(sub);
        sub = this.service.detail.subscribe(data => {
            if (data.item && data.item != this.object) {
                setTimeout(() => this.setImage(data.item), 0);
            }
        });
        this.subs.push(sub);
    }
    ngOnDestroy() {
        this.element.pause();
        this.alive = false;
        this.subs.forEach(sub => sub.unsubscribe());
    }
    setImage(image: IItem) {
        if (!this.alive) {
            return;
        }
        this.object = <CVideo>image;
        this.element.load();
        this.xform = Matrix.Identity();
        this.xform.elements[0][0] = this.object.width;
        this.xform.elements[1][1] = this.object.height;
        this.fitToWindow();
        this.atlas = new ImageAtlas(this.element, this.object);
        this.loadingframes = true;
        let sub = this.atlas.loadedFrame.subscribe(
            frame => this.loadedframe = frame,
            () => null,
            () => {
                this.loadingframes = false;
                this.vctx.drawImage(
                    this.atlas.canvas,
                    0, 0, this.object.width, this.object.height,
                    0, 0, this.object.width, this.object.height
                )
            }
        );
        this.subs.push(sub);
    }
    // -- Events
    up(event: MouseEvent) {
        this.isMouseDown = false;
        let x:number = event.clientX - this.origin.x;
        this.currentframe = Math.floor(this.currentframe + x / 6);
    }
    down(event:MouseEvent) {
        if (event.button == 0) {
            this.isMouseDown = true;
            this.origin.x = event.clientX;
            this.origin.y = event.clientY;
        }
    }
    move(event:MouseEvent) {
        if (this.isMouseDown) {
            let x:number = event.clientX - this.origin.x;
            let padding = 6;
            let frame = Math.floor(this.currentframe + x / padding) % this.frameCount;
            if (frame < 0) {
                frame = this.frameCount + frame;
            }
            this.loadedframe = frame;
            let coords = this.atlas.getCoords(frame);
            this.vctx.drawImage(
                this.atlas.canvas,
                coords[1] * this.object.width, coords[0] * this.object.height, this.object.width, this.object.height,
                0, 0, this.object.width, this.object.height
            )
        }
    }
    @HostListener('window:resize')
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.xform = this.main = new Matrix([
            [this.object.width, 0, 0],
            [0, this.object.height, 0],
            [0, 0, 1]
        ]);
        this.fitToWindow();
    }
    center(scale:number = 1.0) {
        this.xform = new Matrix([
            [this.object.width, 0, 0],
            [0, this.object.height, 0],
            [0, 0, 1]
        ]);
        this.scale(scale, scale);
        let x: number = this.object.width / 2 - this.xform.elements[0][0] / 2;
        let y: number = this.object.height / 2 - this.xform.elements[1][1] / 2;
        this.translate(x, y);

        this.main = this.xform;
    }
    original() {
        this.center();
    }
    fitToWindow() {
        let size = this.xform.rect.fit(window.innerWidth, window.innerHeight - this.infoPadding);
        let scale = size.width / this.object.width;
        this.center(scale);

        this.margin = (window.innerHeight / 2) - ((this.xform.elements[1][1] + this.infoPadding) / 2);
    }
    translate(x:number, y:number) {
        let m1:Matrix = new Matrix([
            [1, 0, 0],
            [0, 1, 0],
            [x, y, 1]
        ]);
        let m2:Matrix = this.xform.x(m1);
        this.xform = m2.dup();
    }
    scale(x:number, y:number) {
        let m1:Matrix = new Matrix([
            [x, 0, 0],
            [0, y, 0],
            [0, 0, 1]
        ]);
        let m2:Matrix = this.xform.x(m1);
        this.xform = m2.dup();
    }
    imageArray() {
        if (!this.frameview) {
            this.element.pause();
            this.element.loop = false;
            this.frameview = true;
            setTimeout(() => this.element.currentTime = 0.0, 0);
        }
    }
}
