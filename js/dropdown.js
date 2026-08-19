// ============================================================================
// SEARCHABLE DROPDOWN COMPONENT
// ============================================================================
// Usage:
//   const dd = new Dropdown(triggerEl, {
//     items: [{value:'a', label:'A'}, ...],
//     value: 'a',                     // atau array untuk multi
//     multi: false,
//     placeholder: 'Cari...',
//     allLabel: 'Semua',              // label untuk "Semua" (multi)
//     onChange: (value) => {}
//   });
// ============================================================================

class Dropdown {
  constructor(triggerEl, opts) {
    this.trigger = triggerEl;
    this.opts = opts || {};
    this.items = opts.items || [];
    this.multi = opts.multi || false;
    this.noAll = opts.noAll || false;  // Kalau true, tidak ada opsi "Semua"
    this.placeholder = opts.placeholder || 'Cari...';
    this.allLabel = opts.allLabel || 'Semua';
    this.onChange = opts.onChange || (() => {});
    this.value = this.multi ? (opts.value || []) : (opts.value || '');
    this._tempValue = null;
    this._popup = null;
    this._open = false;
    this._render();
    this._bindTrigger();
  }

  setItems(items) {
    this.items = items || [];
    // Bersihkan value multi yang tidak ada lagi di items
    if (this.multi) {
      const valid = new Set(items.map(i => i.value));
      this.value = this.value.filter(v => valid.has(v));
    } else if (this.value && !items.find(i => i.value === this.value)) {
      this.value = '';
    }
    this._render();
    if (this._open) this._renderList();
  }

  setValue(v) {
    this.value = this.multi ? (Array.isArray(v) ? v : []) : v;
    this._render();
  }

  getValue() { return this.value; }

  _render() {
    let label;
    if (this.multi) {
      if (this.value.length === 0 || this.value.length === this.items.length) {
        label = this.allLabel;
      } else if (this.value.length === 1) {
        const it = this.items.find(i => i.value === this.value[0]);
        label = it ? it.label : this.value[0];
      } else {
        label = this.value.length + ' dipilih';
      }
    } else {
      if (!this.value) {
        // Kalau noAll dan value kosong, coba pakai item pertama
        if (this.noAll && this.items.length > 0) {
          label = this.items[0].label;
        } else {
          label = this.allLabel;
        }
      } else {
        const it = this.items.find(i => i.value === this.value);
        label = it ? it.label : this.value;
      }
    }
    this.trigger.innerHTML =
      '<span class="dd-label">' + this._escape(label) + '</span>' +
      '<span class="dd-chevron">' + (this._open ? '&#9652;' : '&#9662;') + '</span>';
  }

  _bindTrigger() {
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._open) this.close();
      else this.open();
    });
  }

  open() {
    if (this._open) return;
    this._open = true;
    if (this.multi) this._tempValue = [...this.value];
    this._render();

    this._popup = document.createElement('div');
    this._popup.className = 'dd-popup';
    this._popup.innerHTML =
      '<div class="dd-search-row">' +
        '<input type="text" class="dd-search" placeholder="' + this._escape(this.placeholder) + '" />' +
        '<span class="dd-chevron">&#9652;</span>' +
      '</div>' +
      '<div class="dd-list"></div>' +
      (this.multi ? '<div class="dd-actions"><button class="dd-cancel">Batal</button><button class="dd-ok">OK</button></div>' : '');

    document.body.appendChild(this._popup);
    this.trigger.classList.add('dd-open');
    this._positionPopup();

    this._reposHandler = () => this._positionPopup();
    window.addEventListener('scroll', this._reposHandler, true);
    window.addEventListener('resize', this._reposHandler);

    this._renderList();

    const search = this._popup.querySelector('.dd-search');
    search.addEventListener('input', () => this._renderList(search.value));
    // Delay focus supaya keyboard mobile tidak langsung buka & mengganggu positioning
    setTimeout(() => search.focus(), 50);

    if (this.multi) {
      this._popup.querySelector('.dd-ok').addEventListener('click', () => {
        this.value = [...this._tempValue];
        this.close();
        this.onChange(this.value);
      });
      this._popup.querySelector('.dd-cancel').addEventListener('click', () => this.close());
    }

    // Close on outside click
    this._outsideHandler = (e) => {
      if (!this._popup.contains(e.target) && !this.trigger.contains(e.target)) this.close();
    };
    setTimeout(() => document.addEventListener('click', this._outsideHandler), 0);
  }

  _positionPopup() {
    if (!this._popup) return;
    const rect = this.trigger.getBoundingClientRect();
    const popupWidth = Math.max(rect.width, 220);
    const viewportW = window.innerWidth;
    let left = rect.left;
    // Kalau popup keluar dari viewport kanan, geser
    if (left + popupWidth > viewportW - 8) {
      left = Math.max(8, viewportW - popupWidth - 8);
    }
    // Cek space bawah, kalau tidak cukup buka ke atas
    const maxPopupH = 380;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    let top;
    if (spaceBelow < 200 && rect.top > maxPopupH) {
      // Buka ke atas
      top = Math.max(8, rect.top - maxPopupH - 6);
      this._popup.style.maxHeight = (rect.top - 14) + 'px';
    } else {
      top = rect.bottom + 6;
      this._popup.style.maxHeight = Math.min(maxPopupH, spaceBelow) + 'px';
    }
    this._popup.style.top = top + 'px';
    this._popup.style.left = left + 'px';
    this._popup.style.width = popupWidth + 'px';
  }

  close() {
    if (!this._open) return;
    this._open = false;
    this.trigger.classList.remove('dd-open');
    if (this._popup) {
      this._popup.remove();
      this._popup = null;
    }
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
      this._outsideHandler = null;
    }
    if (this._reposHandler) {
      window.removeEventListener('scroll', this._reposHandler, true);
      window.removeEventListener('resize', this._reposHandler);
      this._reposHandler = null;
    }
    this._render();
  }

  _renderList(query) {
    if (!this._popup) return;
    const list = this._popup.querySelector('.dd-list');
    const q = (query || '').toLowerCase().trim();

    let items = this.items;
    if (q) items = items.filter(i => i.label.toLowerCase().includes(q));

    // Untuk single-select, tambahkan opsi "Semua" di awal (kecuali noAll)
    let html = '';
    if (!this.multi && !this.noAll) {
      const isAll = this.value === '';
      html += '<div class="dd-item ' + (isAll ? 'selected' : '') + '" data-value="">' +
              '<span class="dd-item-label">' + this._escape(this.allLabel) + '</span>' +
              '</div>';
    } else if (this.multi) {
      const allSelected = this._tempValue.length === this.items.length;
      html += '<div class="dd-item dd-item-all">' +
              '<label>' +
              '<input type="checkbox" class="dd-check-all" ' + (allSelected ? 'checked' : '') + ' />' +
              '<span class="dd-item-label">Pilih semua</span>' +
              '</label></div>';
    }

    items.forEach(it => {
      if (this.multi) {
        const checked = this._tempValue.includes(it.value);
        html += '<div class="dd-item"><label>' +
                '<input type="checkbox" data-value="' + this._escape(it.value) + '" ' + (checked ? 'checked' : '') + ' />' +
                '<span class="dd-item-label">' + this._escape(it.label) + '</span>' +
                '</label></div>';
      } else {
        const selected = this.value === it.value;
        html += '<div class="dd-item ' + (selected ? 'selected' : '') + '" data-value="' + this._escape(it.value) + '">' +
                '<span class="dd-item-label">' + this._escape(it.label) + '</span>' +
                '</div>';
      }
    });

    if (items.length === 0) {
      html += '<div class="dd-empty">Tidak ada hasil</div>';
    }

    list.innerHTML = html;

    if (this.multi) {
      const checkAll = list.querySelector('.dd-check-all');
      if (checkAll) {
        checkAll.addEventListener('change', () => {
          if (checkAll.checked) {
            this._tempValue = this.items.map(i => i.value);
          } else {
            this._tempValue = [];
          }
          this._renderList(query);
        });
      }
      list.querySelectorAll('input[type="checkbox"][data-value]').forEach(cb => {
        cb.addEventListener('change', () => {
          const v = cb.getAttribute('data-value');
          if (cb.checked) {
            if (!this._tempValue.includes(v)) this._tempValue.push(v);
          } else {
            this._tempValue = this._tempValue.filter(x => x !== v);
          }
        });
      });
    } else {
      list.querySelectorAll('.dd-item').forEach(el => {
        el.addEventListener('click', () => {
          this.value = el.getAttribute('data-value');
          this.close();
          this.onChange(this.value);
        });
      });
    }
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
}
