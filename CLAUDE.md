# Trip Manager — Claude Guidelines

## UI Component Design Patterns

ทุกครั้งที่มีการเรียกใช้ Select2, Flatpickr calendar, หรือ time input ให้ใช้ design ตามนี้เสมอ

---

## Select2

### CDN
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js"></script>
```

### Global rules (อยู่ใน Style.html แล้ว — ไม่ต้องเพิ่มซ้ำ)
- `.select2-dropdown` — border, border-radius, box-shadow
- `.select2-results__options` — `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` (scroll ได้แต่ไม่เห็น scrollbar)
- `.select2-container--open .select2-dropdown` — `z-index: 100000 !important`

### Init pattern (JS)
```js
$('#my-select').select2({
  minimumResultsForSearch: Infinity, // ไม่มี search box
  dropdownParent: $(document.body),  // ให้ทะลุ overflow:hidden ได้
  width: 'Xpx',                      // กำหนด width ตายตัวเสมอ
});
```

### ห้าม
- `dropdownCssClass` — ต้องการ compat module ที่ CDN build ไม่มี ใช้ `select2:open` event แทน:
```js
$sel.on('select2:open', function() {
  var id = $(this).attr('id');
  $('#select2-' + id + '-results').closest('.select2-dropdown').addClass('my-class');
});
```

---

## Flatpickr Calendar (Date Picker)

### CDN (อยู่ใน Index.html แล้ว)
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js"></script>
```

### HTML input
```html
<input type="text" id="my-date" class="form-input" readonly placeholder="Select date">
```

### JS init
```js
var fp = flatpickr('#my-date', {
  dateFormat:    'Y-m-d',
  altInput:      true,
  altFormat:     'D d M Y',   // แสดงผลสวย เช่น "Mon 23 May 2026"
  disableMobile: true,
  onReady:       function (_, __, fp) { _initFpDropdowns(fp); },
  onMonthChange: function (_, __, fp) { _syncFpDropdowns(fp); },
  onYearChange:  function (_, __, fp) { _syncFpDropdowns(fp); },
  onChange:      function (_, __, fp) { $(fp.input).removeClass('error'); },
});
```

### Calendar design
- `border-radius: 16px`, `width: 318px`, `padding: 16px 14px 14px`
- Header มี border-bottom แบ่งจาก grid
- ปุ่ม prev/next เป็นวงกลม 30×30px
- วันในตาราง — `border-radius: 50%` (วงกลม), มี scale animation
- Today — primary tint background
- Selected — primary color + drop shadow

### Month/Year dropdown ใน calendar header
ใช้ฟังก์ชัน `_initFpDropdowns(fp)` และ `_syncFpDropdowns(fp)` ที่มีอยู่ใน Script.html แล้ว
- เดือน: Select2 fixed width `130px`, `.selection` width `90px`
- ปี: Select2 fixed width `70px`
- ไม่มีลูกศร (`select2-selection__arrow { display: none }`)
- เดือนและปีชิดกัน (`gap: 0`)
- Dropdown list ใช้ class `fp-s2-dropdown` (add ผ่าน `select2:open` event)
- ป้องกัน Flatpickr ปิดตอน Select2 เปิด — `stopPropagation` บน mousedown ของ `.select2` container

---

## Time Input

### HTML
```html
<div class="sf-dt-time-wrap">
  <svg class="sf-time-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
  <input type="time" id="sf-time" class="form-input sf-dt-time" placeholder="HH:MM">
</div>
```

### CSS (อยู่ใน Style.html แล้ว)
- `.sf-dt-time-wrap` — `position: relative; width: 190px`
- `.sf-time-icon` — absolute, ซ้ายกลาง, `color: var(--c-text-muted)`
- `.sf-dt-time` — `padding-left: 33px` เพื่อเว้นพื้นที่ icon

### Date + Time combined field
```html
<div class="sf-dt-row">
  <div class="sf-dt-date-wrap">
    <input type="text" id="sf-date" class="form-input sf-dt-date" readonly placeholder="Select date">
  </div>
  <div class="sf-dt-time-wrap">
    <svg class="sf-time-icon" ...></svg>
    <input type="time" id="sf-time" class="form-input sf-dt-time" placeholder="HH:MM">
  </div>
</div>
```

### รวมค่าตอน save
```js
var dateVal = $('#sf-date').val();
var timeVal = $('#sf-time').val() || '00:00';
var dateTime = dateVal + 'T' + timeVal;
```

### แยกค่าตอน load
```js
var dtParts = (record.dateTime || '').split('T');
fpDate.setDate(dtParts[0] || '', false);
$('#sf-time').val(dtParts[1] || '');
```

### reset
```js
fpDate.clear();
$('#sf-time').val('');
```

---

## CSS Design Tokens ที่ใช้
```css
var(--c-primary)      /* สี primary */
var(--c-text)         /* สีข้อความหลัก */
var(--c-text-muted)   /* สีข้อความรอง */
var(--c-surface)      /* พื้นหลัง card/popup */
var(--c-bg)           /* พื้นหลัง hover */
var(--c-border)       /* สี border */
var(--ease)           /* transition timing */
var(--r)              /* border-radius หลัก */
var(--r-sm)           /* border-radius เล็ก */
var(--shadow-lg)      /* box-shadow ใหญ่ */
```

## Rules
- ห้ามใช้ `style="..."` inline ทุกกรณี
- ห้ามใช้ `onclick="..."` inline ทุกกรณี
- ห้ามใช้ `:focus` styles บน input
- Select2 ทุกที่ใช้ `dropdownParent: $(document.body)` เสมอ
- Select2 ทุกที่ต้องกำหนด `width` ตายตัวเสมอ
