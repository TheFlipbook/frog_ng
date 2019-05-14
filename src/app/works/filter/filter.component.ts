import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { NavigationComponent } from '../navigation/navigation.component';
import { TagsListComponent } from '../../tags/tags-list/tags-list.component';
import { ReleaseNotesComponent } from '../../releasenotes/release-notes/release-notes.component';
import { SiteConfig, User, ReleaseNote, Tag, Gallery } from '../../shared/models';
import { WorksService } from '../works.service';
import { UploaderService } from '../../uploader/uploader.service';
import { PreferencesService } from '../../user/preferences.service';
import { GalleryService } from '../gallery.service';
import { UserService } from '../../user/user.service';
import { TagsService } from '../../tags/tags.service';
import { ReleaseNotesService } from '../../releasenotes/release-notes.service';
import { SiteConfigService } from '../../shared/siteconfig.service';



@Component({
    selector: 'works-filter',
    templateUrl: './filter.component.html',
    styleUrls: ['./filter.component.css']
})
export class FilterComponent implements OnInit, OnDestroy {
    @ViewChild(NavigationComponent) nav: NavigationComponent;
    @ViewChild(TagsListComponent) tagslist: TagsListComponent;
    @ViewChild(ReleaseNotesComponent) releasenotes: ReleaseNotesComponent;

    public siteconfig: SiteConfig;
    public user: User;
    public notes: ReleaseNote[];
    public gallery: Gallery;
    private galleryid: number;
    private query: string;
    private subs: Subscription[];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public service: WorksService,
        private uploadservice: UploaderService,
        public preferencesService: PreferencesService,
        private galleryservice: GalleryService,
        private userservice: UserService,
        private tagservice: TagsService,
        private releasenotesservice: ReleaseNotesService,
        private siteconfigservice: SiteConfigService
    ) {
        this.subs = [];
        this.notes = [];
    }
    ngOnInit() {
        let sub;
        sub = this.siteconfigservice.siteconfig.subscribe(data => {
            this.siteconfig = data;
            // -- Set the favicon
            document.getElementById('favicon').setAttribute('href', data.favicon);
        });
        this.subs.push(sub);

        sub = this.galleryservice.gallery.subscribe(gallery => this.gallery = gallery);
        this.subs.push(sub);

        sub = this.userservice.user.subscribe(user => this.user = user);
        this.subs.push(sub);

        sub = this.route.params.subscribe(params => {
            this.galleryid = +params['id'];
            this.galleryservice.setGalleryId(this.galleryid);
            this.service.reset();
            if (params['terms']) {
                let terms = this.dumps(params['terms']);
                this.service.setTerms(terms);
            }
            this.service.get(this.galleryid);
        });
        this.subs.push(sub);

        sub = this.releasenotesservice.notes.subscribe(notes => this.notes = notes);
        this.subs.push(sub);
    }
    ngOnDestroy() {
        this.subs.map(sub => sub.unsubscribe());
    }
    addTag(event: any) {
        this.tagservice.resolve(event.value).subscribe(tag => {
            if (tag) {
                this.addTagString(tag.id);
            }
            else {
                this.addTagString(event.value);
            }
        });
    }
    addTagString(name: string) {
        this.router.navigate(['w/' + this.galleryid + '/' + name]);
    }
    removeTag(tag: Tag, row: number, col: number) {
        let terms = this.service.terms.splice(0);
        terms[row].splice(col, 1);
        terms = terms.filter(row => row.length > 0);
        if (terms.length < 2) {
            terms.push([]);
        }
        let query = [];
        for (let bucket of terms) {
            if (bucket.length) {
                query.push(bucket.join('|'));
            }
        }
        if (query.length && query[0].length > 0) {
            this.router.navigate([`w/${this.galleryid}/${query.join('+')}`]);
        }
        else {
            this.router.navigate([`w/${this.galleryid}`]);
        }
    }
    addFiles(event: Event) {
        let element = <HTMLInputElement>event.target;
        this.uploadservice.addFiles(element.files);
        element.value = null;
    }
    gallerySelectHandler(gallery: Gallery) {
        this.router.navigate(['w/' + gallery.id]);
    }
    private parseUserInput(input: string) {
        input = input.toLocaleLowerCase();
        let buckets = input.split(' and ');
        let ors = [];
        for (let bucket of buckets) {
            let b = [];
            for (let value of bucket.split(' or ')) {
                let tag = this.tagservice.getTagByName(value.trim());
                if (tag == null) {
                    b.push(value);
                }
                else {
                    b.push(tag.id);
                }
            }

            ors.push(b.join('|'));
        }

        return ors.join('+');
    }
    private dumps(url: string) {
        let query = [];
        let buckets = url.split('+');
        for (let bucket of buckets) {
            let b = [];
            for (let value of bucket.split('|')) {
                if (isNaN(Number(value))) {
                    b.push(value);
                }
                else {
                    b.push(Number(value));
                }
            }
            query.push(b);
        }

        return query;
    }
}