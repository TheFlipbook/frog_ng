import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";

import { ReplaySubject } from 'rxjs/ReplaySubject';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';

import { IItem, Tag } from '../shared/models';
import { UploadFile } from './models';
import { WorksService } from '../works/works.service';
import { ErrorService } from "../errorhandling/error.service";


@Injectable()
export class UploaderService {
    public requested: Subject<boolean>;
    public fileList: ReplaySubject<UploadFile[]>;
    private file: UploadFile;
    private files: UploadFile[];
    private items: IItem[];

    constructor(private http: HttpClient, private service: WorksService, private errors: ErrorService) {
        this.requested = new Subject<boolean>();
        this.fileList = new ReplaySubject<UploadFile[]>(1);
        this.items = [];
        this.files = [];
    }
    show() {
        this.requested.next(true);
    }
    isUnique(names: string[]) {
        let url = '/frog/isunique/';
        let options = {
            body: {
                paths: names
            },
            withCredentials: true
        };

        return this.http.post(url, options)
            .map(this.errors.extractValues, this.errors);
    }
    addFiles(files: FileList) {
        if (files.length === 0) {
            return;
        }

        let filelist = [];
        for (let i = 0; i < files.length; i++) {
            filelist.push(new UploadFile(files[i]));
        }
        this.isUnique(filelist.map(file => file.filename())).subscribe(items => {
            let uploadfiles = this.files.slice(0);
            items.forEach((item, index) => {
                if (item !== true) {
                    filelist[index].unique = false;
                    filelist[index].created = new Date(item.created);
                    filelist[index].data = item;
                }
                uploadfiles.push(filelist[index]);
            });
            this.files = uploadfiles;
            this.fileList.next(this.files);
            this.requested.next(true);
        }, error => this.errors.handleError(error));
    }
    clearFiles() {
        this.items = [];
        this.files = [];
        this.fileList.next(this.files);
    }
    upload(files: UploadFile[], tags: Tag[]) {
        this.files = files;

        return Observable.create(observer => {
            let tagstring = tags.map(function(_) { return _.name; }).join(',');
            this.uploadFile(this.files[0], tagstring, observer);
        });
    }
    private uploadFile(file: UploadFile, tags: string, observer: Observer<UploadFile[]>) {
        let url: string = '/frog/';
        let fd: FormData = new FormData();
        let xhr: XMLHttpRequest = new XMLHttpRequest();
        this.file = file;

        fd.append('file', file.file, this.file.filename());
        fd.append('tags', tags);
        fd.append('galleries', this.service.id.toString());
        fd.append('title', file.name);

        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    let data = JSON.parse(xhr.response);

                    if (data.isError) {
                        this.files[0].status = data.message;
                        return;
                    }

                    let item = <IItem>data.value;
                    if (item) {
                        this.items.push(item);
                    }

                    this.files.shift();

                    if (this.files.length) {
                        this.uploadFile(this.files[0], tags, observer);
                    }
                    else {
                        observer.complete();
                        this.service.addItems(this.items);
                        this.items = [];
                    }
                }
                else {
                    observer.error(xhr.response);
                }
            }
        };
        xhr.upload.onprogress = (event) => {
            this.file.progress = Math.round(event.loaded / event.total * 100);
            this.file.status = 'Uploading...';
            if (this.file.progress == 100) {
                this.file.status = 'Processing...';
            }
            observer.next(this.files);
        };

        xhr.open('POST', url, true);
        xhr.withCredentials = true;
        xhr.send(fd);
    }
}
