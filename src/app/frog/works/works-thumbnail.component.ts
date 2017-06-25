import {Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit, HostListener, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { Observable } from 'rxjs';

import { WorksService } from './works.service';
import { ViewportService } from './viewport.service';
import {IItem, Preferences} from '../shared/models';
import { Rect } from '../shared/euclid';
import { CapitalizePipe } from '../shared/capitalize.pipe';
import { TagsService } from '../tags/tags.service';
import { SelectionService } from '../shared/selection.service';
import { PreferencesService } from '../user/preferences.service';

declare var $:any;

@Component({
    selector: 'thumbnail',
    templateUrl: './html/works-thumbnail.html',
    styles: [
        'img { width: 100%; height: auto; display: block; }',
        'p { position: absolute; bottom: 12px; width: 100%; font-size: 18px; color: #fff; font-weight: normal; overflow: hidden; cursor: pointer; line-height: initial; }',
        'div > i { vertical-align: middle; cursor: pointer; }',
        'div > small { vertical-align: middle; }',
        '.actions { position: absolute; right: 4px; bottom: 4px; cursor: pointer; }',
        '.tiny { font-size: 1.2rem; }',
        '.author { position: absolute; left: 4px; bottom: 10px; font-size: 0.8rem; cursor: pointer; }',
        '.semi { opacity: 0.5; }',
        '.tags { position: absolute; top: 0; left: 0; }',
        '.tag { line-height: 26px; background-color: #fff; color: #000; margin: 0 2px; padding: 2px; border: 1px solid #333; border-radius: 2px;}'
    ]
})
export class WorksThumbnailComponent implements OnDestroy, AfterViewInit {
    @Input() item;
    @ViewChild('img') img: ElementRef;

    private selecteditems: IItem[] = [];
    private ctrlKey: boolean;
    private subs: Subscription[];
    private viewportsub: Subscription;
    private loaded: boolean;
    public prefs: Preferences;
    public thumbnail: string;

    constructor(
        private element: ElementRef,
        private router: Router,
        private service: SelectionService,
        private worksservice: WorksService,
        private viewportservice: ViewportService,
        private tags: TagsService,
        private prefservice: PreferencesService
        ) {
        this.service.selection.subscribe(items => this.selecteditems = items);
        this.subs = [];
        this.thumbnail = '/public/pixel.png';
        let sub = this.service.selectionRect.subscribe(rect => {
            let r = this.element.nativeElement.getBoundingClientRect();
            if (rect.intersects(r)) {
                this.service.selectItem(this.item);
            }
        });
        this.subs.push(sub);
        sub = this.prefservice.preferences.subscribe(prefs => this.prefs = prefs);
        this.subs.push(sub);
    }
    ngOnDestroy() {
        this.subs.forEach(sub => sub.unsubscribe());
    }
    ngAfterViewInit() {
        this.viewportsub = this.viewportservice.guids.subscribe(guids => {
            if (guids.indexOf(this.item.guid) != -1 && !this.loaded) {
                this.loaded = true;
                setTimeout(() => {this.load();});
            }
        });
    }
    load() {
        this.thumbnail = this.item.thumbnail;
        this.item.loaded = true;
        this.element.nativeElement.classList.add('loaded');
    }
    clickHandler(event: MouseEvent) {
        event.preventDefault();
        if (event.shiftKey) {
            this.service.selectItem(this.item, true);
        }
        else {
            let guids = [this.item.guid];
            let index = 0;
            if (this.selecteditems.length) {
                guids = this.selecteditems.map(function(x) { return x.guid; });
                index = guids.indexOf(this.item.guid);
                if (index === -1) {
                    guids.push(this.item.guid);
                    index = guids.length - 1;
                }
            }
            index = Math.max(0, index);
            let nav = ['/v', index, guids.join(',')];
            if (guids.length === 1) {
                nav.push('+')
            }
            this.router.navigate(nav);
        }
    }
    like() {
        this.worksservice.likeItem(this.item);
    }
    setFocus(event) {
        this.service.setDetailItem(this.item);
    }
    setAuthor(name: string) {
        let tag = this.tags.getTagByName(name);
        if (tag != null) {
            this.router.navigate(['/w/' + this.worksservice.id + '/' + tag.id]);
        }
    }
}
