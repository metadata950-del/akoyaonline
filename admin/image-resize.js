// Akoya Admin: ہر اپ لوڈ ہونے والی تصویر خود بخود 800x800 (چوکور) اور 200KB سے کم کی ہو جاتی ہے۔
(function(){
  var SIZE = 800, MAX_BYTES = 200 * 1024, MIN_SIZE = 480;

  function loadBitmap(file){
    if (window.createImageBitmap){
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function(){ return viaImage(file); });
    }
    return viaImage(file);
  }
  function viaImage(file){
    return new Promise(function(res, rej){
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function(){ URL.revokeObjectURL(url); res(im); };
      im.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('image load failed')); };
      im.src = url;
    });
  }
  function toBlob(canvas, q){
    return new Promise(function(res){ canvas.toBlob(res, 'image/jpeg', q); });
  }
  function dims(src){ return { w: src.width || src.naturalWidth, h: src.height || src.naturalHeight }; }

  async function shrink(file){
    var src = await loadBitmap(file), d = dims(src);
    var side = Math.min(d.w, d.h), sx = (d.w - side) / 2, sy = (d.h - side) / 2;   // بیچ سے چوکور کاٹیں
    var out = Math.min(SIZE, side), blob = null;
    while (true){
      var c = document.createElement('canvas'); c.width = c.height = out;
      var g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, out, out);
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, sx, sy, side, side, 0, 0, out, out);
      for (var q = 0.88; q >= 0.4; q -= 0.06){
        blob = await toBlob(c, q);
        if (blob && blob.size <= MAX_BYTES) break;
      }
      if ((blob && blob.size <= MAX_BYTES) || out <= MIN_SIZE) break;
      out = Math.max(MIN_SIZE, Math.round(out * 0.9));
    }
    var name = (file.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_') || 'photo';
    return new File([blob], name + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  }

  document.addEventListener('change', async function(e){
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'file' || el.__akoyaDone) return;
    var files = Array.prototype.slice.call(el.files || []);
    if (!files.length || !files.some(function(f){ return /^image\//.test(f.type); })) return;
    e.stopImmediatePropagation(); e.preventDefault();
    try{
      var done = await Promise.all(files.map(function(f){
        return /^image\/(jpeg|png|webp)$/.test(f.type) ? shrink(f) : Promise.resolve(f);
      }));
      var dt = new DataTransfer(); done.forEach(function(f){ dt.items.add(f); });
      el.files = dt.files;
    }catch(err){ console.warn('image resize failed, uploading original', err); }
    el.__akoyaDone = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(function(){ el.__akoyaDone = false; }, 0);
  }, true);
})();
