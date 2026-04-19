import React from "react";

type OptimizedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  widths?: number[]; // widths to generate srcset
  sizes?: string;
  priority?: boolean; // when true, loading="eager"
};

function isCloudinary(url: string) {
  return /res\.cloudinary\.com/.test(url);
}

function buildCloudinaryUrl(src: string, width: number) {
  const parts = src.split("/upload/");
  if (parts.length < 2) return src;
  const prefix = parts[0];
  const rest = parts.slice(1).join("/upload/");
  // add transformations: f_auto,q_auto,w_{width}
  return `${prefix}/upload/f_auto,q_auto,w_${width}/${rest}`;
}

export default function OptimizedImage({
  src,
  alt,
  className,
  widths = [320, 480, 640, 960, 1280],
  sizes,
  priority,
  style,
  ...rest
}: OptimizedImageProps) {
  if (!src) return null;

  const loading = priority ? "eager" : (rest.loading as string) || "lazy";

  if (isCloudinary(src)) {
    const srcSet = widths
      .map((w) => `${buildCloudinaryUrl(src, w)} ${w}w`)
      .join(", ");
    // pick a sensible default src (middle size)
    const mid = widths[Math.floor(widths.length / 2)];
    const defaultSrc = buildCloudinaryUrl(src, mid);

    return (
      // eslint-disable-next-line jsx-a11y/alt-text
      <img
        src={defaultSrc}
        srcSet={srcSet}
        sizes={sizes ?? "100vw"}
        loading={loading as any}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        className={className}
        alt={alt}
        style={style}
        {...rest}
      />
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      src={src}
      loading={loading as any}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      className={className}
      alt={alt}
      style={style}
      {...rest}
    />
  );
}
